import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Prices come from OpenRouter: its public models API for LLMs (list prices per provider) and
 * the Jev model page for Jev, which the API doesn't list. `oss prices` refreshes data/prices.json.
 */

export interface PriceEntry {
  /** Tokenizer family for counting: "openai" and "anthropic" have exact counters, others are estimated. */
  provider: "openai" | "anthropic" | "other";
  in: number; // USD per 1M input tokens
  out: number; // USD per 1M output tokens
  source: string;
  checked: string;
  aliases?: string[];
  speed?: ModelSpeed;
}

/** OpenRouter's live stats for the model's busiest provider (its model page, last-30-minute window). */
export interface ModelSpeed {
  p50LatencyMs: number;
  p50ThroughputTps: number;
  requests: number;
  windowMinutes: number;
  source: string;
  fetchedAt: string;
}

export interface PriceTable {
  source: string;
  fetchedAt: string;
  jev: { in: number; out: number; source: string; checked: string; note?: string };
  models: Record<string, PriceEntry>; // keyed by OpenRouter model id, e.g. "openai/gpt-4o-mini"
}

const PRICES_PATH = fileURLToPath(new URL("../../data/prices.json", import.meta.url));
const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";
const JEV_PAGE = "https://openrouter.ai/typesafe/jev-1.13";

export function loadPrices(p = PRICES_PATH): PriceTable {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Prices refreshed by `oss prices` into the state directory, else the snapshot bundled with the package. */
export function loadPricesFor(out: string): PriceTable {
  const local = path.join(out, "prices.json");
  return loadPrices(fs.existsSync(local) ? local : PRICES_PATH);
}

const vendorOf = (id: string) => id.split("/")[0];
const providerOf = (vendor: string): PriceEntry["provider"] =>
  vendor === "openai" ? "openai" : vendor === "anthropic" ? "anthropic" : "other";

/** Fetches current OpenRouter prices. Jev keeps its previous entry if its page can't be read. */
export async function fetchPrices(previous?: PriceTable, f: typeof fetch = fetch): Promise<PriceTable> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await f(OPENROUTER_MODELS);
  if (!res.ok) throw new Error(`OpenRouter models API returned ${res.status}`);
  const data: any[] = (await res.json()).data ?? [];
  const models: Record<string, PriceEntry> = {};
  for (const m of data) {
    const id: string = m.id;
    if (id.includes(":")) continue; // ":free", ":batch" and similar variants aren't list prices
    const pin = Number(m.pricing?.prompt), pout = Number(m.pricing?.completion);
    if (!Number.isFinite(pin) || !Number.isFinite(pout) || pin < 0 || pout < 0) continue; // "-1" = variable pricing
    models[id] = {
      provider: providerOf(vendorOf(id)),
      in: +(pin * 1e6).toFixed(6),
      out: +(pout * 1e6).toFixed(6),
      source: `https://openrouter.ai/${id}`,
      checked: today,
      ...(m.canonical_slug && m.canonical_slug !== id ? { aliases: [m.canonical_slug] } : {}),
    };
  }

  let jev = previous?.jev;
  try {
    const html = await (await f(JEV_PAGE)).text();
    const m = html.match(/\$([\d.]+) per million input tokens, \$([\d.]+) per million output tokens/);
    if (m) jev = { in: Number(m[1]), out: Number(m[2]), source: JEV_PAGE, checked: today, note: "list price" };
  } catch {
    /* keep the previous entry */
  }
  if (!jev) throw new Error(`Could not read Jev's price from ${JEV_PAGE} and no previous price is stored.`);
  return { source: OPENROUTER_MODELS, fetchedAt: new Date().toISOString(), jev, models };
}

/**
 * Reads per-provider p50 latency and throughput from the model's OpenRouter page (the public API returns
 * them as null without a key) and keeps the provider with the most requests in the window.
 */
export async function fetchSpeed(id: string, f: typeof fetch = fetch): Promise<ModelSpeed | undefined> {
  const url = `https://openrouter.ai/${id}`;
  const res = await f(url, { headers: { "user-agent": "Mozilla/5.0 (jev-swap)" } });
  if (!res.ok) return undefined;
  const text = (await res.text()).replace(/\\+"/g, '"');
  const re = /"p50_latency":([\d.]+)[^{}]*?"p50_throughput":([\d.]+)[^{}]*?"request_count":(\d+),"window_minutes":(\d+)/g;
  let best: ModelSpeed | undefined;
  for (const m of text.matchAll(re)) {
    const s: ModelSpeed = {
      p50LatencyMs: Number(m[1]), p50ThroughputTps: Number(m[2]), requests: Number(m[3]), windowMinutes: Number(m[4]),
      source: url, fetchedAt: new Date().toISOString(),
    };
    if (s.requests > 0 && s.p50ThroughputTps > 0 && (!best || s.requests > best.requests)) best = s;
  }
  return best;
}

export function savePrices(t: PriceTable, p = PRICES_PATH) {
  fs.writeFileSync(p, JSON.stringify(t, null, 2) + "\n");
}

/** Which OpenRouter vendor a bare model name belongs to. */
function inferVendor(name: string): string | undefined {
  if (/^(gpt-|o\d|chatgpt|codex)/.test(name)) return "openai";
  if (name.startsWith("claude")) return "anthropic";
  if (/^(gemini|gemma)/.test(name)) return "google";
  if (name.startsWith("grok")) return "x-ai";
  if (/^(mistral|mixtral|codestral|ministral|pixtral|magistral|devstral)/.test(name)) return "mistralai";
  if (name.startsWith("deepseek")) return "deepseek";
  if (/^(qwen|qwq)/.test(name)) return "qwen";
  if (name.startsWith("llama")) return "meta-llama";
  if (name.startsWith("command")) return "cohere";
  return undefined;
}

/**
 * Model strings as written in code -> OpenRouter ids to try, most specific first.
 * Handles gateway ids ("openai/gpt-4o"), Bedrock/Vertex decorations, date snapshots, "-latest",
 * and Anthropic's API names ("claude-haiku-4-5" is "anthropic/claude-haiku-4.5" on OpenRouter).
 */
export function candidateIds(modelId: string): { ids: string[]; bare: string } {
  let s = modelId.trim().toLowerCase().replace(/^openrouter\//, "").replace(/:.*$/, "");
  let vendor: string | undefined;
  const slash = s.indexOf("/");
  if (slash > 0) { vendor = s.slice(0, slash); s = s.slice(slash + 1); }
  s = s
    .replace(/^(us\.|eu\.|global\.)?anthropic\./, "") // Bedrock
    .replace(/-v\d+(:\d+)?$/, "")
    .replace(/@\d{8}$/, ""); // Vertex
  const bare = s;
  const undated = s.replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, "").replace(/-latest$/, "");
  const dotted = (x: string) => x.replace(/(\d)-(\d)(?=$|-)/g, "$1.$2");
  vendor ??= inferVendor(undated);
  const names = [...new Set([s, undated, dotted(s), dotted(undated)])];
  const ids = vendor ? names.map((n) => `${vendor}/${n}`) : [];
  return { ids: [...new Set(ids)], bare: undated };
}

/** Exact matches only (no prefix matching: "gpt-4" must never price "gpt-4o"). */
export function lookupPrice(table: PriceTable, modelId: string): { key: string; entry: PriceEntry; bare: string } | undefined {
  const index = new Map<string, string>();
  for (const [key, e] of Object.entries(table.models)) {
    index.set(key, key);
    for (const a of e.aliases ?? []) index.set(a, key);
  }
  const { ids, bare } = candidateIds(modelId);
  for (const id of ids) {
    const key = index.get(id);
    if (key) return { key, entry: table.models[key], bare };
  }
  return undefined;
}
