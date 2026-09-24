/**
 * GitHub REST access for discovery.
 * Repository search (GET /search/repositories) supports stars:/topic:/language:/pushed: qualifiers, sorts by stars,
 * and allows 30 requests/minute authenticated, 10 unauthenticated, at most 1,000 results per query.
 * Code search (GET /search/code) requires authentication,
 * allows 10 requests/minute, returns at most 100 items per page and 1,000 per query, and only
 * searches default branches and files under 384 KB (docs.github.com/en/rest/search/search, checked 2026-09-23).
 */

const API = "https://api.github.com";
const SEARCH_INTERVAL_MS = 6_500; // stays under 10 requests/minute
const REPO_SEARCH_INTERVAL_MS = { authed: 2_100, anon: 6_500 }; // under 30 / 10 requests/minute

export type Fetch = typeof fetch;

export interface RepoMeta {
  fullName: string;
  url: string;
  stars: number;
  ownerType: "Organization" | "User";
  fork: boolean;
  archived: boolean;
  private: boolean;
  license: string | null; // SPDX id, "NOASSERTION" when GitHub can't tell, null when none
  defaultBranch: string;
  sizeKb: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function headers(token: string | undefined): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "jev-swap",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/** GET with waits on primary/secondary rate limits (403/429 with retry-after or x-ratelimit-reset). */
export async function ghGet(path: string, token: string | undefined, f: Fetch = fetch, attempt = 0): Promise<any> {
  const res = await f(`${API}${path}`, { headers: headers(token) });
  if ((res.status === 403 || res.status === 429) && attempt < 3) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (retryAfter || remaining === "0") {
      const wait = retryAfter ? retryAfter * 1000 : Math.max(1000, reset * 1000 - Date.now() + 1000);
      console.warn(`  rate limited; waiting ${Math.ceil(wait / 1000)}s`);
      await sleep(wait);
      return ghGet(path, token, f, attempt + 1);
    }
  }
  // Search sometimes returns transient 5xx (e.g. 503 "too many shards failed"): back off and retry.
  if (res.status >= 500 && attempt < 3) {
    const wait = [5, 15, 45][attempt] * 1000;
    console.warn(`  GitHub ${res.status}; retrying in ${wait / 1000}s`);
    await sleep(wait);
    return ghGet(path, token, f, attempt + 1);
  }
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function repoMeta(fullName: string, token: string | undefined, f: Fetch = fetch): Promise<RepoMeta> {
  const r = await ghGet(`/repos/${fullName}`, token, f);
  return {
    fullName: r.full_name,
    url: r.html_url,
    stars: r.stargazers_count,
    ownerType: r.owner?.type,
    fork: r.fork,
    archived: r.archived,
    private: r.private,
    license: r.license?.spdx_id ?? null,
    defaultBranch: r.default_branch,
    sizeKb: r.size,
  };
}

/** File paths at a ref (one API call). `truncated` is set by GitHub for very large trees. */
export async function repoTree(fullName: string, ref: string, token: string | undefined, f: Fetch = fetch): Promise<{ sha: string; truncated: boolean; paths: string[] }> {
  const r = await ghGet(`/repos/${fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token, f);
  return { sha: r.sha, truncated: !!r.truncated, paths: (r.tree ?? []).filter((e: any) => e.type === "blob").map((e: any) => e.path) };
}

/** Raw file contents (raw.githubusercontent.com, outside the REST API rate limit). */
export async function rawFile(fullName: string, sha: string, filePath: string, f: Fetch = fetch): Promise<string | undefined> {
  const res = await f(`https://raw.githubusercontent.com/${fullName}/${sha}/${filePath.split("/").map(encodeURIComponent).join("/")}`);
  return res.ok ? res.text() : undefined;
}

export interface SearchHit { repo: string; path: string }

/**
 * Runs one code-search query, page by page, pacing requests. `onPage` is called after each page so the
 * caller can persist progress; `startPage` resumes a partially-run query.
 */
export async function searchCode(
  query: string,
  opts: { token: string; maxPages: number; startPage?: number; fetch?: Fetch; interval?: number },
  onPage: (page: number, hits: SearchHit[], totalCount: number, lastPage: boolean) => void,
): Promise<void> {
  const f = opts.fetch ?? fetch;
  const interval = opts.interval ?? SEARCH_INTERVAL_MS;
  const start = opts.startPage ?? 1;
  const end = Math.min(start + opts.maxPages - 1, 10); // --pages per run; 10 x 100 = the 1,000-result cap
  for (let page = start; page <= end; page++) {
    const r = await ghGet(`/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`, opts.token, f);
    const hits: SearchHit[] = (r.items ?? [])
      .filter((i: any) => !i.repository?.private && !i.repository?.fork)
      .map((i: any) => ({ repo: i.repository.full_name, path: i.path }));
    const exhausted = page >= 10 || page * 100 >= Math.min(r.total_count ?? 0, 1000) || (r.items ?? []).length === 0;
    onPage(page, hits, r.total_count ?? 0, exhausted);
    if (exhausted || page === end) return;
    await sleep(interval);
  }
}

export interface RepoHit { repo: string; stars: number; ownerType: "Organization" | "User" }

/** Like searchCode, for repository search sorted by stars (most starred first). Token optional. */
export async function searchRepos(
  query: string,
  opts: { token?: string; maxPages: number; startPage?: number; fetch?: Fetch; interval?: number },
  onPage: (page: number, hits: RepoHit[], totalCount: number, lastPage: boolean) => void,
): Promise<void> {
  const f = opts.fetch ?? fetch;
  const interval = opts.interval ?? (opts.token ? REPO_SEARCH_INTERVAL_MS.authed : REPO_SEARCH_INTERVAL_MS.anon);
  const start = opts.startPage ?? 1;
  const end = Math.min(start + opts.maxPages - 1, 10);
  for (let page = start; page <= end; page++) {
    const r = await ghGet(`/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=100&page=${page}`, opts.token, f);
    const hits: RepoHit[] = (r.items ?? [])
      .filter((i: any) => !i.private && !i.fork && !i.archived)
      .map((i: any) => ({ repo: i.full_name, stars: i.stargazers_count, ownerType: i.owner?.type }));
    const exhausted = page >= 10 || page * 100 >= Math.min(r.total_count ?? 0, 1000) || (r.items ?? []).length === 0;
    onPage(page, hits, r.total_count ?? 0, exhausted);
    if (exhausted || page === end) return;
    await sleep(interval);
  }
}

/** Topics that well-known LLM apps and libraries tag themselves with. */
export const DEFAULT_TOPICS = ["llm", "openai", "chatgpt", "anthropic", "langchain", "rag", "ai-agents", "generative-ai", "chatbot", "llmops"];
/** The languages the scanner reads. */
export const SCANNED_LANGUAGES = ["Python", "TypeScript", "JavaScript"];

/** One repo-search query per topic and language: well-starred, not archived, pushed within the last year. */
export function repoQueries(minStars: number, topics = DEFAULT_TOPICS, now = new Date()): string[] {
  const since = new Date(now.getTime() - 365 * 864e5).toISOString().slice(0, 10);
  return topics.flatMap((t) => SCANNED_LANGUAGES.map((l) => `topic:${t} language:${l} stars:>=${minStars} pushed:>=${since} archived:false fork:false`));
}

/**
 * The most-starred repos in the scanned languages, whatever their topic: that's where company products are.
 * Split into star bands because each query returns at most 1,000 results.
 */
export function popularQueries(minStars: number, now = new Date()): string[] {
  const since = new Date(now.getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const edges = [...new Set([minStars, ...[2000, 5000, 10000, 20000, 50000].filter((e) => e > minStars)])];
  const bands = edges.map((lo, i) => (i + 1 < edges.length ? `stars:${lo}..${edges[i + 1] - 1}` : `stars:>=${lo}`));
  return SCANNED_LANGUAGES.flatMap((l) => bands.map((b) => `language:${l} ${b} pushed:>=${since} archived:false fork:false`));
}

/**
 * Narrow queries per SDK and pattern. Each needs a decision-shaped output (enum, Literal, boolean
 * schema) next to an LLM call, so hits are likely candidates; the scanner decides.
 */
export const DEFAULT_CODE_QUERIES = [
  // TypeScript / JavaScript
  "zodResponseFormat z.enum language:TypeScript",
  "zodResponseFormat z.boolean language:TypeScript",
  "generateObject z.enum language:TypeScript",
  "Output.choice generateText language:TypeScript",
  "\"output: 'enum'\" generateObject",
  "chat.completions.create response_format json_schema enum language:TypeScript",
  "messages.create tool_choice input_schema enum language:TypeScript",
  // Python
  "with_structured_output Literal language:Python",
  "with_structured_output Enum BaseModel language:Python",
  "chat.completions.parse Literal language:Python",
  "responses.parse text_format Literal language:Python",
  "response_format json_schema enum openai language:Python",
  "messages.create tool_choice input_schema enum anthropic language:Python",
];
