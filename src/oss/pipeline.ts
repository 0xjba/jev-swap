import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Candidate, DecisionField, ModelRef } from "../types.js";
import { llmSdkCheck } from "./deps.js";
import { DEFAULT_CODE_QUERIES, popularQueries, repoMeta, repoQueries, searchCode, searchRepos, type Fetch, type RepoMeta } from "./github.js";
import { loadPricesFor, lookupPrice, type PriceTable } from "./prices.js";
import { staticTokens, type StaticTokens } from "./tokens.js";
import { jevRequestTokens, loadJevProfile, type JevProfile } from "./jev.js";

const run = promisify(execFile);

// ---------- state on disk ----------

export interface Queue {
  repos: Record<string, { addedAt: string; via: string[]; stars?: number; ownerType?: string }>;
  queries: Record<string, { nextPage: number; done: boolean; totalCount?: number }>;
}

/** What we keep per candidate: location, schema shape, model, token counts. No prompt text or code. */
export interface StoredCandidate {
  id: string;
  file: string;
  line: number;
  language: Candidate["language"];
  provider: Candidate["provider"];
  api: string;
  signal: Candidate["signal"];
  fields: DecisionField[];
  droppedFields: string[];
  model: ModelRef | null;
  priceKey: string | null;
  tokens: StaticTokens;
}

export interface ScanRecord {
  repo: string;
  url: string;
  status: "ok" | "skipped" | "error";
  reason?: string;
  sha?: string;
  license?: string | null;
  stars?: number;
  ownerType?: string;
  /** LLM SDKs found in production dependency manifests before cloning. */
  llmSdks?: string[];
  scannedAt: string;
  candidates: StoredCandidate[];
  /** Candidates in test files: not production traffic, so not stored. */
  testCandidatesSkipped?: number;
}

const OPTOUT_PATH = fileURLToPath(new URL("../../data/optout.txt", import.meta.url));

const queuePath = (out: string) => path.join(out, "queue.json");
const scanPath = (out: string, repo: string) => path.join(out, "scans", `${repo.replace("/", "__")}.json`);

export function loadQueue(out: string): Queue {
  const p = queuePath(out);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { repos: {}, queries: {} };
}

function saveQueue(out: string, q: Queue) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(queuePath(out), JSON.stringify(q, null, 2));
}

/** data/optout.txt: one "owner/repo" or "owner/*" per line; '#' starts a comment. */
export function loadOptOut(p = OPTOUT_PATH): (repo: string) => boolean {
  const lines = fs.existsSync(p)
    ? fs.readFileSync(p, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim().toLowerCase()).filter(Boolean)
    : [];
  return (repo) => {
    const r = repo.toLowerCase();
    return lines.some((l) => l === r || (l.endsWith("/*") && r.startsWith(l.slice(0, -1))));
  };
}

function enqueue(q: Queue, repo: string, via: string, optedOut: (r: string) => boolean, info: { stars?: number; ownerType?: string } = {}): boolean {
  if (optedOut(repo)) return false;
  const e = q.repos[repo];
  if (e) {
    if (!e.via.includes(via)) e.via.push(via);
    Object.assign(e, info);
    return false;
  }
  q.repos[repo] = { addedAt: new Date().toISOString(), via: [via], ...info };
  return true;
}

// ---------- 1. discover ----------

export interface DiscoverOptions {
  /**
   * "repos": repository search by AI topic, sorted by stars (default).
   * "popular": the most-starred repos in the scanned languages, any topic (company products).
   * "code": code search for SDK patterns (needs a token).
   */
  mode: "repos" | "popular" | "code";
  token?: string;
  queries?: string[];
  maxPages: number;
  minStars: number;
  orgsOnly: boolean;
  fetch?: Fetch;
  interval?: number;
}

export async function discover(out: string, opts: DiscoverOptions) {
  const q = loadQueue(out);
  const optedOut = loadOptOut();
  const queries = opts.queries?.length ? opts.queries
    : opts.mode === "repos" ? repoQueries(opts.minStars)
    : opts.mode === "popular" ? popularQueries(opts.minStars)
    : DEFAULT_CODE_QUERIES;
  for (const query of queries) {
    const key = `${opts.mode}:${query}`;
    const state = (q.queries[key] ??= { nextPage: 1, done: false });
    // Older runs marked a query done when it hit --pages; reopen those that still have results left.
    if (state.done && state.nextPage <= 10 && (state.totalCount ?? 0) > (state.nextPage - 1) * 100) state.done = false;
    if (state.done) { console.log(`  done already: ${query}`); continue; }
    let added = 0;
    const page = { token: opts.token, maxPages: opts.maxPages, startPage: state.nextPage, fetch: opts.fetch, interval: opts.interval };
    const save = (p: number, total: number, last: boolean) => {
      Object.assign(state, { nextPage: p + 1, done: last, totalCount: total }); // last = results exhausted, not the page cap
      saveQueue(out, q);
    };
    try {
      if (opts.mode !== "code") {
        await searchRepos(query, page, (p, hits, total, last) => {
          for (const h of hits) {
            if (h.stars < opts.minStars || (opts.orgsOnly && h.ownerType !== "Organization")) continue;
            if (enqueue(q, h.repo, key, optedOut, { stars: h.stars, ownerType: h.ownerType })) added++;
          }
          save(p, total, last);
        });
      } else {
        // Code search can't filter by stars; the scan step applies --min-stars / --orgs-only from repo metadata.
        await searchCode(query, { ...page, token: opts.token! }, (p, hits, total, last) => {
          for (const h of hits) if (enqueue(q, h.repo, key, optedOut)) added++;
          save(p, total, last);
        });
      }
    } catch (e) {
      // Progress so far is saved; the next run resumes this query from its next page.
      console.warn(`  ${query}: failed, will resume on the next run (${(e as Error).message.slice(0, 120)})`);
      continue;
    }
    console.log(`  ${query}: ${state.totalCount} matched, ${added} new repo(s)`);
  }
  console.log(`Queue: ${Object.keys(q.repos).length} repo(s) in ${queuePath(out)}`);
}

export function addRepos(out: string, repos: string[]) {
  const q = loadQueue(out);
  const optedOut = loadOptOut();
  for (const r of repos) {
    const name = r.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) throw new Error(`Not an owner/repo: ${r}`);
    if (optedOut(name)) console.log(`  ${name}: opted out, skipped`);
    else console.log(`  ${name}: ${enqueue(q, name, "manual", optedOut) ? "added" : "already queued"}`);
  }
  saveQueue(out, q);
}

// ---------- 2. scan ----------

export interface ScanOptions {
  limit: number;
  rescan: boolean;
  maxSizeMb: number;
  includeUnlicensed: boolean;
  minStars: number;
  /** Only repos with fewer stars than this (to sample less-known repos for the metrics). */
  maxStars?: number;
  orgsOnly: boolean;
  /** Clone even when no LLM SDK shows up in the repo's production manifests. */
  skipSdkCheck: boolean;
  /** Re-scan repos earlier skipped for "no LLM SDK" (to measure raw-HTTP calls the pre-check misses). */
  recheckNoSdk?: boolean;
  timeoutSec: number;
  token?: string;
  fetch?: Fetch;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// The CLI beside this module: dist/cli.js when built, src/cli.ts under tsx (whose loader is in execArgv).
// Never process.argv[1]: when scanRepo is called from another script, that would re-run the caller.
const CLI_PATH = [new URL("../cli.js", import.meta.url), new URL("../cli.ts", import.meta.url)]
  .map((u) => fileURLToPath(u))
  .find((p) => fs.existsSync(p))!;

/** Runs `jev-swap scan` in a child process so a huge or odd repo can't take the pipeline down. */
async function scanDir(dir: string, timeoutSec: number): Promise<Candidate[]> {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "jev-swap-scan-"));
  try {
    await run(process.execPath, [...process.execArgv, CLI_PATH, "scan", dir, "-o", tmpOut], {
      timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(fs.readFileSync(path.join(tmpOut, "candidates.json"), "utf8"));
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
}

const TEST_FILE = /(^|\/)(tests?|__tests__|spec|__mocks__)\/|\.(test|spec|test-d)\.[cm]?[jt]sx?$|(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/;
export const isTestFile = (file: string) => TEST_FILE.test(file.split(path.sep).join("/"));

/**
 * Only calls in a project's real code count. Sample/demo/docs code and eval/benchmark/script code
 * don't carry production traffic, so they're excluded from the dashboard (and counted in totals).
 */
const EXAMPLE_DIR = /^(examples?|demos?|samples?|sample-apps?|cookbooks?|playgrounds?|tutorials?|notebooks?|quickstarts?|starters?|templates?|showcases?|sandbox(es)?|docs?|documentation|website|recipes|courses?|workshops?)$/i;
const EVAL_DIR = /^(evals?|evaluations?|benchmarks?|bench|experiments?|scripts|fixtures|mocks?|e2e|stories|storybook|devtools|dev|\.github)$/i;
const EVAL_FILE = /(^|[_.-])(evals?|benchmarks?)([_.-]|$)/i;
const EXAMPLE_FILE = /(^|[_.-])(examples?|demos?|samples?)([_.-]|$)/i;

export type NonProduction = "example" | "eval";

export function nonProductionReason(file: string): NonProduction | null {
  const parts = file.split(/[\\/]/);
  const base = parts.pop()!.replace(/\.[^.]+$/, "");
  // Lesson-numbered files ("01_structured_output.py", "05-agents.ts") are course material.
  if (parts.some((p) => EXAMPLE_DIR.test(p)) || EXAMPLE_FILE.test(base) || /^\d{1,3}[_-][a-z]/i.test(base)) return "example";
  if (parts.some((p) => EVAL_DIR.test(p)) || EVAL_FILE.test(base)) return "eval";
  return null;
}

/** Repos that are collections of samples rather than a product, e.g. "hyperbrowser-app-examples". */
export const isSampleRepo = (repo: string) =>
  /(^|[-_.])(examples?|demos?|samples?|tutorials?|cookbooks?|templates?|starters?|boilerplates?|awesome|courses?|workshops?|learn(ing)?|hello|lessons?|guides?|handbook)([-_.]|$)/i.test(repo.split("/")[1] ?? "");

async function toStored(c: Candidate, prices: PriceTable): Promise<StoredCandidate> {
  const priced = c.model?.id ? lookupPrice(prices, c.model.id) : undefined;
  return {
    id: c.id, file: c.file, line: c.line, language: c.language, provider: c.provider, api: c.api,
    signal: c.signal, droppedFields: c.droppedFields,
    fields: c.fields.map(({ description: _, ...shape }) => shape as DecisionField), // shape only, no source text
    model: c.model ? { id: c.model.id, source: c.model.source, envVar: c.model.envVar } : null, // no source expression
    priceKey: priced?.key ?? null,
    // Tokenizers take the provider's own model name (e.g. "claude-haiku-4-5"), not the OpenRouter id.
    tokens: await staticTokens(c, priced && priced.entry.provider !== "other" ? priced.entry.provider : undefined, priced?.bare),
  };
}

const NO_SDK = "no LLM SDK in production dependencies";

export async function scanRepo(repo: string, opts: ScanOptions, prices: PriceTable): Promise<ScanRecord> {
  const base = { repo, url: `https://github.com/${repo}`, scannedAt: new Date().toISOString(), candidates: [] };
  let meta: RepoMeta;
  try {
    meta = await repoMeta(repo, opts.token, opts.fetch);
  } catch (e) {
    return { ...base, status: "error", reason: `metadata: ${(e as Error).message}` };
  }
  const info = { url: meta.url, license: meta.license, stars: meta.stars, ownerType: meta.ownerType };
  if (meta.stars < opts.minStars || (opts.maxStars !== undefined && meta.stars >= opts.maxStars)) return { ...base, ...info, status: "skipped", reason: `outside the star filter (${meta.stars} stars)` };
  if (opts.orgsOnly && meta.ownerType !== "Organization") return { ...base, ...info, status: "skipped", reason: "not organization-owned" };
  if (meta.private) return { ...base, ...info, status: "skipped", reason: "private" };
  if (isSampleRepo(repo)) return { ...base, ...info, status: "skipped", reason: "sample/demo repository" };
  if (meta.fork) return { ...base, ...info, status: "skipped", reason: "fork" };
  if (meta.archived) return { ...base, ...info, status: "skipped", reason: "archived" };
  if (!meta.license && !opts.includeUnlicensed) return { ...base, ...info, status: "skipped", reason: "no license detected" };
  if (meta.sizeKb > opts.maxSizeMb * 1024) return { ...base, ...info, status: "skipped", reason: `repo larger than ${opts.maxSizeMb} MB` };

  let llmSdks: string[] | undefined;
  if (!opts.skipSdkCheck) {
    try {
      const nonProd = (p: string) => isTestFile(p) || nonProductionReason(p) !== null;
      const check = await llmSdkCheck(repo, meta.defaultBranch, opts.token, nonProd, opts.fetch);
      if (check.uses === false) return { ...base, ...info, status: "skipped", reason: NO_SDK };
      if (check.uses) llmSdks = check.sdks;
    } catch {
      /* can't tell: clone and scan anyway */
    }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jev-swap-clone-"));
  try {
    await run("git", ["clone", "--depth", "1", "--single-branch", "--no-tags", "--quiet", `https://github.com/${repo}.git`, dir], {
      timeout: opts.timeoutSec * 1000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    const sha = (await run("git", ["-C", dir, "rev-parse", "HEAD"])).stdout.trim();
    const all = await scanDir(dir, opts.timeoutSec);
    const candidates = all.filter((c) => !isTestFile(c.file));
    const stored: StoredCandidate[] = [];
    for (const c of candidates) stored.push(await toStored(c, prices));
    return { ...base, ...info, status: "ok", sha, llmSdks, candidates: stored, testCandidatesSkipped: all.length - candidates.length };
  } catch (e) {
    const err = e as Error & { killed?: boolean };
    return { ...base, ...info, status: "error", reason: err.killed ? `timed out after ${opts.timeoutSec}s` : err.message.split("\n")[0].slice(0, 300) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true }); // never keep the code
  }
}

export async function scanQueue(out: string, opts: ScanOptions & { concurrency: number }) {
  const q = loadQueue(out);
  const optedOut = loadOptOut();
  const prices = loadPricesFor(out);
  const needsScan = (r: string) => {
    if (opts.rescan || !fs.existsSync(scanPath(out, r))) return true;
    const rec = JSON.parse(fs.readFileSync(scanPath(out, r), "utf8")) as ScanRecord;
    if (opts.recheckNoSdk) return rec.status === "skipped" && (rec.reason ?? "").startsWith(NO_SDK);
    if (opts.includeUnlicensed && rec.status === "skipped" && rec.reason === "no license detected") return true; // now in scope
    return rec.status === "error"; // retry failures
  };
  const pending = Object.keys(q.repos).filter((r) => !optedOut(r) && needsScan(r));

  // Code-search hits arrive without stars. Fetch them first (one cheap API call each) so we can rank
  // and filter before cloning anything.
  const unknown = pending.filter((r) => q.repos[r].stars === undefined);
  if (unknown.length) {
    console.log(`Fetching stars for ${unknown.length} repo(s)...`);
    await pool(unknown, 8, async (r) => {
      try {
        const m = await repoMeta(r, opts.token, opts.fetch);
        Object.assign(q.repos[r], { stars: m.stars, ownerType: m.ownerType });
      } catch (e) {
        console.warn(`  ${r}: ${(e as Error).message.slice(0, 120)}`);
      }
    });
    saveQueue(out, q);
  }

  const eligible = pending.filter((r) => {
    const e = q.repos[r];
    return e.stars !== undefined && e.stars >= opts.minStars && (opts.maxStars === undefined || e.stars < opts.maxStars)
      && (!opts.orgsOnly || e.ownerType === "Organization");
  });
  const todo = eligible.sort((a, b) => q.repos[b].stars! - q.repos[a].stars!).slice(0, opts.limit); // most-starred first
  const filters = [`--min-stars ${opts.minStars}`, opts.maxStars !== undefined ? `--max-stars ${opts.maxStars}` : "", opts.orgsOnly ? "--orgs-only" : ""].filter(Boolean).join(" ");
  console.log(`${eligible.length} unscanned repo(s) match ${filters} (${pending.length - eligible.length} don't). Scanning ${todo.length}...`);
  fs.mkdirSync(path.join(out, "scans"), { recursive: true });
  await pool(todo, opts.concurrency, async (repo) => {
    const rec = await scanRepo(repo, opts.recheckNoSdk ? { ...opts, skipSdkCheck: true } : opts, prices);
    fs.writeFileSync(scanPath(out, repo), JSON.stringify(rec, null, 2));
    console.log(`  ${repo} (${rec.stars ?? "?"}★): ${rec.status === "ok" ? `${rec.candidates.length} candidate(s) @ ${rec.sha!.slice(0, 7)}` : `${rec.status} (${rec.reason})`}`);
  });
}

// ---------- 3. estimate ----------

/**
 * All-Jev reduction for one call, with `stateTokens` of user input on both sides:
 *   llm_cost = (prompt + state) * llm_in + output * llm_out
 *   jev_cost = (jev_request + state_factor * state) * jev_in   (Jev output is free; jev_request from the measured profile)
 *   reduction = 1 - jev_cost / llm_cost
 */
export function reductionAt(t: StaticTokens, llm: { in: number; out: number }, jev: { in: number; out: number }, stateTokens: number, stateFactor = 1) {
  const llmCost = ((t.llmPrompt.tokens + stateTokens) * llm.in + t.llmOutput.tokens * llm.out) / 1e6;
  const jevCost = ((t.jevStatic.tokens + stateFactor * stateTokens) * jev.in) / 1e6;
  return { llmCost, jevCost, reduction: llmCost > 0 ? 1 - jevCost / llmCost : null };
}

type CandidateStatus = "estimated" | "partial-swap" | "model-unknown" | "price-unknown";

const REF_PATH = fileURLToPath(new URL("../../data/reference-models.json", import.meta.url));

type Verdict = "cheaper" | "same-cost-faster" | "no-saving";

export interface ModelEval {
  key: string;
  in: number;
  out: number;
  reductionAllJev: { low: number; high: number };
  /** Estimated LLM time for this call: OpenRouter p50 latency + output tokens / p50 throughput. */
  llmMs: number | null;
  /** llmMs / Jev's measured p50; null without speed data. */
  speedup: number | null;
  /** cheaper: >= 5% lower at the low end. same-cost-faster: within 15% of the LLM cost and >= 1.5x faster. */
  verdict: Verdict;
}

function evalModel(t: StaticTokens, key: string, e: PriceTable["models"][string], jev: PriceTable["jev"], stateMin: number, stateMax: number, prof: JevProfile): ModelEval | null {
  const a = reductionAt(t, e, jev, stateMin, prof.stateFactor).reduction;
  const b = reductionAt(t, e, jev, stateMax, prof.stateFactor).reduction;
  if (a === null || b === null) return null;
  const low = Math.min(a, b), high = Math.max(a, b);
  const llmMs = e.speed ? e.speed.p50LatencyMs + (t.llmOutput.tokens / e.speed.p50ThroughputTps) * 1000 : null;
  const speedup = llmMs !== null ? llmMs / prof.p50Ms : null;
  const verdict: Verdict = low >= 0.05 ? "cheaper" : low > -0.15 && (speedup ?? 0) >= 1.5 ? "same-cost-faster" : "no-saving";
  return { key, in: e.in, out: e.out, reductionAllJev: { low, high }, llmMs, speedup, verdict };
}

export interface DashboardCandidate {
  id: string;
  link: string;
  file: string;
  line: number;
  language: string;
  provider: string;
  api: string;
  signal: string;
  fields: { name: string; kind: string; options?: string[]; min?: number; max?: number }[];
  droppedFields: string[];
  model: string | null;
  modelSource: ModelRef["source"] | null;
  status: CandidateStatus;
  tokens: {
    llmPrompt: number; llmPromptMethod: string;
    llmOutput: number; llmOutputMethod: string;
    jevStatic: number; jevStaticMethod: string;
    promptInSource: boolean;
  };
  price: { key: string; in: number; out: number; source: string; checked: string } | null;
  /** All-Jev reduction over the assumed user-input range. Always labelled "estimated" in this phase. */
  reductionAllJev: { low: number; high: number; label: "estimated" } | null;
  /** For a priced model: estimated LLM time vs Jev's 500 ms, and the cost/speed verdict. */
  speed: { llmMs: number; jevMs: number; speedup: number } | null;
  verdict: Verdict | null;
  /**
   * For model-unknown calls: likely models (named elsewhere in the repo, else common models of the SDK's provider)
   * where Jev is cheaper or about the same cost and faster. Conditional figures, kept out of the headline totals.
   */
  likelyModels: (ModelEval & { basis: string })[];
  /** Likely models tried but not shown because Jev saves neither cost nor time against them. */
  likelyModelsHidden: number;
}

export interface Dashboard {
  generatedAt: string;
  methodology: {
    formulas: string[];
    assumptions: string[];
    stateTokenRange: [number, number];
    jevPrice: PriceTable["jev"];
    /** Jev's measured request profile (billed tokens and latency) behind every Jev figure. */
    jevProfile: JevProfile;
    jevLatencyMs: number;
  };
  totals: {
    reposQueued: number;
    reposScanned: number;
    reposSkipped: number;
    reposErrored: number;
    reposWithCandidates: number;
    candidates: number;
    /** Candidates counted in the headline: model known and priced, and every output field maps to Jev. */
    candidatesEstimated: number;
    /** Calls left out because they aren't production code: sample/demo/docs paths, eval/benchmark/script paths, sample repos. */
    excludedNonProduction: Record<NonProduction | "sampleRepo", number>;
    /** Listed candidates found as raw HTTP calls (fetch, axios, requests, httpx ...) rather than SDK calls. */
    candidatesViaHttp: number;
    byStatus: Record<CandidateStatus, number>;
    medianReductionLow: number | null;
    /** Estimated calls: median LLM-time / Jev-time. */
    medianSpeedup: number | null;
    /** Model-unknown calls with at least one likely model shown, and the median of each call's least favourable shown reduction. */
    likely: { calls: number; medianConservativeReductionLow: number | null };
    /** The same figures for featured repos only. */
    featured: { minStars: number; repos: number; candidates: number; candidatesEstimated: number; medianReductionLow: number | null };
  };
  repos: {
    repo: string; url: string; sha: string; license: string | null; stars: number; ownerType: string | null; scannedAt: string;
    /** Well-known repo (stars >= featuredMinStars): shown individually. Every repo counts toward the metrics. */
    featured: boolean;
    candidates: DashboardCandidate[];
  }[];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function buildDashboard(out: string, opts: { stateMin: number; stateMax: number; featuredMinStars: number; prices?: PriceTable }): Dashboard {
  const prof = loadJevProfile(out);
  const prices = opts.prices ?? loadPricesFor(out);
  const optedOut = loadOptOut();
  const q = loadQueue(out);
  const dir = path.join(out, "scans");
  const records: ScanRecord[] = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    : [];
  const visible = records.filter((r) => !optedOut(r.repo));
  const byStatus: Record<CandidateStatus, number> = { estimated: 0, "partial-swap": 0, "model-unknown": 0, "price-unknown": 0 };
  const lows: number[] = [];
  const speedups: number[] = [];
  const bestLikely: number[] = [];
  const ref: { families: Record<string, string[]>; sdkFamilies: Record<string, string> } = JSON.parse(fs.readFileSync(REF_PATH, "utf8"));

  const repos: Dashboard["repos"] = [];
  const excluded: Record<NonProduction | "sampleRepo", number> = { example: 0, eval: 0, sampleRepo: 0 };
  for (const r of visible.filter((r) => r.status === "ok" && r.candidates.length)) {
    if (isSampleRepo(r.repo)) { excluded.sampleRepo += r.candidates.length; continue; }
    const production = r.candidates.filter((c) => {
      const why = nonProductionReason(c.file);
      if (why) excluded[why]++;
      return !why;
    });
    if (!production.length) continue;
    // Models this repo names in its other decision calls: the best guess for its runtime-configured ones.
    const repoModels = [...new Set(r.candidates.map((c) => (c.model?.id ? lookupPrice(prices, c.model.id)?.key : undefined)).filter((k): k is string => !!k))];
    const sdkFamilies = [...new Set((r.llmSdks ?? []).map((d) => ref.sdkFamilies[d]).filter(Boolean))];
    const cands = production.map((c): DashboardCandidate => {
      // Re-price from the current table so price updates don't need a re-scan.
      const priced = c.model?.id ? lookupPrice(prices, c.model.id) : undefined;
      // Jev's billed request size from the measured profile: base + per question. A yes/no-prompt question
      // also carries its prompt text (kept from scan time as a chars/4 estimate).
      const extra = c.signal === "schema" ? 0 : prof.stateFactor * c.tokens.jevStatic.tokens;
      const t: StaticTokens = {
        ...c.tokens,
        jevStatic: { tokens: Math.round(jevRequestTokens(prof, c.fields.length, 0) + extra), method: "estimate:chars/4" },
      };
      let status: CandidateStatus;
      if (!c.model?.id) status = "model-unknown";
      else if (!priced) status = "price-unknown";
      else if (c.droppedFields.length) status = "partial-swap";
      else status = "estimated";
      byStatus[status]++;

      let reductionAllJev: DashboardCandidate["reductionAllJev"] = null;
      let speed: DashboardCandidate["speed"] = null;
      let verdict: Verdict | null = null;
      if (priced) {
        const ev = evalModel(t, priced.key, priced.entry, prices.jev, opts.stateMin, opts.stateMax, prof);
        if (ev) {
          reductionAllJev = { ...ev.reductionAllJev, label: "estimated" };
          verdict = ev.verdict;
          if (ev.llmMs !== null) speed = { llmMs: Math.round(ev.llmMs), jevMs: prof.p50Ms, speedup: ev.speedup! };
        }
      }
      if (status === "estimated" && reductionAllJev) lows.push(reductionAllJev.low);
      if (status === "estimated" && speed) speedups.push(speed.speedup);

      let likelyModels: DashboardCandidate["likelyModels"] = [];
      let likelyModelsHidden = 0;
      if (status === "model-unknown") {
        const fams = c.provider === "openai" || c.provider === "anthropic" ? [c.provider]
          : sdkFamilies.length ? sdkFamilies : Object.keys(ref.families);
        const tries: [string, string][] = repoModels.length
          ? repoModels.map((k) => [k, "named elsewhere in this repo"])
          : fams.flatMap((f) => (ref.families[f] ?? []).map((k): [string, string] => [k, `common small ${f} model`]));
        const evals = tries.flatMap(([k, basis]) => {
          const e = prices.models[k];
          const ev = e ? evalModel(t, k, e, prices.jev, opts.stateMin, opts.stateMax, prof) : null;
          return ev ? [{ ...ev, basis }] : [];
        });
        likelyModels = evals.filter((e) => e.verdict !== "no-saving")
          .sort((x, y) => y.reductionAllJev.low - x.reductionAllJev.low || (y.speedup ?? 0) - (x.speedup ?? 0));
        likelyModelsHidden = evals.length - likelyModels.length;
        // Aggregate on the least favourable shown model, not the best one.
        if (likelyModels.length) bestLikely.push(Math.min(...likelyModels.map((m) => m.reductionAllJev.low)));
      }

      return {
        id: c.id,
        link: `${r.url}/blob/${r.sha}/${c.file.split(path.sep).join("/")}#L${c.line}`,
        file: c.file, line: c.line, language: c.language, provider: c.provider, api: c.api, signal: c.signal,
        fields: c.fields,
        droppedFields: c.droppedFields,
        model: c.model?.id ?? null,
        modelSource: c.model?.id ? c.model.source : null,
        status,
        tokens: {
          llmPrompt: c.tokens.llmPrompt.tokens, llmPromptMethod: c.tokens.llmPrompt.method,
          llmOutput: c.tokens.llmOutput.tokens, llmOutputMethod: c.tokens.llmOutput.method,
          jevStatic: t.jevStatic.tokens, jevStaticMethod: t.jevStatic.method,
          promptInSource: c.tokens.promptInSource,
        },
        price: priced ? { key: priced.key, in: priced.entry.in, out: priced.entry.out, source: priced.entry.source, checked: priced.entry.checked } : null,
        reductionAllJev,
        speed,
        verdict,
        likelyModels,
        likelyModelsHidden,
      };
    });
    repos.push({ repo: r.repo, url: r.url, sha: r.sha!, license: r.license ?? null, stars: r.stars ?? 0, ownerType: r.ownerType ?? null,
      featured: (r.stars ?? 0) >= opts.featuredMinStars, scannedAt: r.scannedAt, candidates: cands });
  }
  repos.sort((a, b) => Number(b.featured) - Number(a.featured) || b.stars - a.stars);

  return {
    generatedAt: new Date().toISOString(),
    methodology: {
      formulas: [
        "llm_cost = (prompt_tokens + state_tokens) * llm_price_in + output_tokens * llm_price_out",
        "jev_cost = (jev_request_tokens + state_factor * state_tokens) * jev_price_in   (Jev output tokens are free)",
        "reduction_all_jev = 1 - jev_cost / llm_cost",
      ],
      assumptions: [
        `state_tokens (the user input each call sends) is unknown from source, so each figure is a range over ${opts.stateMin}-${opts.stateMax} tokens; the same count is used on both sides.`,
        "prompt_tokens counts only prompt text found in the call's source, without interpolated input. Prompts loaded from files or other modules are missed (promptInSource: false).",
        "output_tokens is the smallest JSON the schema allows. Reasoning tokens, schema/tool definitions, tool-use system prompts and chat framing are left out of llm_cost, so llm_cost is a lower bound and the reduction is conservative.",
        `jev_request_tokens = ${prof.baseTokens} + ${prof.perQuestion} per question, and state_factor = ${prof.stateFactor}: Jev's billed input tokens, fitted from ${prof.calls} live Jev calls on ${prof.measuredAt.slice(0, 10)} (jev-swap oss measure-jev).`,
        `Prices are list prices from OpenRouter (${prices.source}, fetched ${prices.fetchedAt.slice(0, 10)}); Jev's from its OpenRouter page. Calls whose model can't be read or isn't listed there are shown but left out of totals.`,
        "Only production code counts. Calls in tests, examples/demos/samples/docs/cookbooks/templates, evals/benchmarks/scripts/experiments, and in repositories that are sample collections are left out.",
        "Calls that also return free-text fields Jev can't produce are 'partial-swap' and left out of totals: the LLM call would still be needed.",
        "Absolute dollars are never shown: traffic volume is unknown, and it cancels out of a percentage.",
        `Speed: the LLM's time for a call is estimated as OpenRouter's p50 latency plus output tokens / p50 throughput, from the model's busiest provider on its OpenRouter page (a 30-minute window at fetch time). Jev is taken at ${prof.p50Ms} ms, its p50 over ${prof.calls} live calls measured end to end on ${prof.measuredAt.slice(0, 10)} (TypeSafe reports 70-500 ms).`,
        "Verdicts: 'cheaper' when Jev is at least 5% cheaper at the low end of the input range; 'about the same cost, faster' when within 15% of the LLM's cost and at least 1.5× faster; otherwise no saving.",
        "Calls whose model is chosen at runtime are compared with likely models: ones the same repo names in its other decision calls, else the provider's small default models (data/reference-models.json: hand-picked, not usage data), which are also the cheapest, so the savings shown are the conservative ones. Only models where Jev is cheaper, or about the same cost and faster, are shown; these conditional figures stay out of the headline totals.",
      ],
      stateTokenRange: [opts.stateMin, opts.stateMax],
      jevPrice: prices.jev,
      jevProfile: prof,
      jevLatencyMs: prof.p50Ms,
    },
    totals: {
      reposQueued: Object.keys(q.repos).filter((r) => !optedOut(r)).length,
      reposScanned: visible.filter((r) => r.status === "ok").length,
      reposSkipped: visible.filter((r) => r.status === "skipped").length,
      reposErrored: visible.filter((r) => r.status === "error").length,
      reposWithCandidates: repos.length,
      candidates: repos.reduce((s, r) => s + r.candidates.length, 0),
      candidatesEstimated: byStatus.estimated,
      excludedNonProduction: excluded,
      candidatesViaHttp: repos.reduce((n, r) => n + r.candidates.filter((c) => c.api.startsWith("http ")).length, 0),
      byStatus,
      medianReductionLow: median(lows),
      medianSpeedup: median(speedups),
      likely: { calls: bestLikely.length, medianConservativeReductionLow: median(bestLikely) },
      featured: (() => {
        const fr = repos.filter((r) => r.featured);
        const fc = fr.flatMap((r) => r.candidates);
        const est = fc.filter((c) => c.status === "estimated" && c.reductionAllJev);
        return {
          minStars: opts.featuredMinStars, repos: fr.length, candidates: fc.length, candidatesEstimated: est.length,
          medianReductionLow: median(est.map((c) => c.reductionAllJev!.low)),
        };
      })(),
    },
    repos,
  };
}
