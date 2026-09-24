import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { applyThreshold } from "../convert.js";
import { buildQuestions } from "../questions.js";
import { compareAnswers, curveFor, isExact, mockFetch } from "../shadow.js";
import type { Candidate } from "../types.js";
import { dashboardHtml } from "./dashboard.js";
import { type Api, extractAnswer, extractText, extractUsage, matchCandidate } from "./match.js";

export interface ProxyOptions {
  host: string;
  port: number;
  out: string;
  mock: boolean;
  mockAgreement: number;
  target: number;
  minSamples: number;
  jevPriceIn: number;
  llmPriceIn?: number;
  llmPriceOut?: number;
  openaiUpstream: string;
  anthropicUpstream: string;
}

interface Mirror {
  n: number;
  at: number;
  candidate: string;
  state: string;
  llm: Record<string, unknown>;
  jev?: Record<string, string | boolean | number>;
  perField?: Record<string, boolean | null>;
  conf?: number;
  exact?: boolean;
  llmMs: number;
  jevMs?: number;
  llmCost: number | null;
  jevCost?: number;
  error?: string;
}

const MAX_PER_CANDIDATE = 20000;
const HOP_BY_HOP = new Set(["host", "connection", "content-length", "accept-encoding", "keep-alive", "transfer-encoding", "upgrade"]);
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function startProxy(candidates: Candidate[], o: ProxyOptions) {
  // What users type: "localhost" for the loopback interface.
  const shownHost = o.host === "127.0.0.1" || o.host === "::1" ? "localhost" : o.host;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const questions = new Map(candidates.map((c) => [c.id, buildQuestions(c)]));
  const expected = new Map<string, Record<string, unknown>>();
  const jevClient = o.mock
    ? new TypeSafeClient({ apiKey: "mock", fetch: mockFetch(expected, o.mockAgreement, true) as never, logLevel: "error" })
    : new TypeSafeClient({ logLevel: "error" });

  const started = Date.now();
  const mirrors = new Map<string, Mirror[]>(candidates.map((c) => [c.id, []]));
  const counters = { requests: 0, mirrored: 0, streamingSkipped: 0, unmatched: 0, unparsed: 0 };
  const applied = new Map<string, number>();
  let seq = 0;

  fs.mkdirSync(o.out, { recursive: true });
  const samplesPath = path.join(o.out, "proxy-samples.jsonl");
  const samplesLog = fs.createWriteStream(samplesPath, { flags: "a" });

  const llmCostOf = (u?: { input_tokens: number; output_tokens: number }) =>
    u && o.llmPriceIn !== undefined && o.llmPriceOut !== undefined ? (u.input_tokens * o.llmPriceIn + u.output_tokens * o.llmPriceOut) / 1e6 : null;

  async function runJev(c: Candidate, state: string) {
    const t0 = performance.now();
    const res: any = await jevClient.systemOne({ state, questions: questions.get(c.id) as never });
    return { res, ms: performance.now() - t0 };
  }

  async function mirror(c: Candidate, api: Api, reqBody: any, upstreamRes: Promise<{ json: any; ms: number } | undefined>) {
    const { user } = extractText(api, reqBody);
    const state = user;
    // Real mode fires Jev at request time, in parallel with the LLM. The mock needs the LLM answer first.
    const jevEarly = o.mock ? undefined : runJev(c, state).catch((e) => ({ error: String(e) }) as const);
    const up = await upstreamRes;
    if (!up) return;
    const llm = extractAnswer(api, c, up.json);
    if (!llm) {
      counters.unparsed++;
      return;
    }
    const usage = extractUsage(up.json);
    samplesLog.write(JSON.stringify({ candidate: c.id, state, llm, ...(usage ? { llm_usage: usage } : {}) }) + "\n");

    const m: Mirror = { n: ++seq, at: Date.now(), candidate: c.id, state: state.slice(0, 400), llm, llmMs: up.ms, llmCost: llmCostOf(usage) };
    let jr: any;
    if (o.mock) {
      expected.set(JSON.stringify(state), llm);
      jr = await runJev(c, state).catch((e) => ({ error: String(e) }));
    } else {
      jr = await jevEarly;
    }
    if (jr.error) {
      m.error = jr.error;
    } else {
      const cmp = compareAnswers(c, jr.res.answers, llm);
      Object.assign(m, { jev: cmp.jev, perField: cmp.perField, conf: cmp.conf, exact: isExact(cmp.perField), jevMs: jr.ms });
      m.jevCost = (jr.res.usage?.input_tokens ?? 0) * o.jevPriceIn / 1e6;
    }
    const list = mirrors.get(c.id)!;
    list.push(m);
    if (list.length > MAX_PER_CANDIDATE) list.shift();
    counters.mirrored++;
  }

  async function forward(api: Api, req: http.IncomingMessage, res: http.ServerResponse, rest: string) {
    counters.requests++;
    const upstream = (api === "openai" ? o.openaiUpstream : o.anthropicUpstream).replace(/\/$/, "");
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase()) && typeof v === "string") headers[k] = v;
    }

    let parsed: any;
    try {
      parsed = body?.length ? JSON.parse(body.toString("utf8")) : undefined;
    } catch {
      parsed = undefined;
    }
    const cand = parsed && req.method === "POST" ? matchCandidate(candidates, api, parsed) : undefined;
    const streaming = parsed?.stream === true;
    if (parsed && req.method === "POST" && !cand) counters.unmatched++;
    if (cand && streaming) counters.streamingSkipped++;

    let resolveUp!: (v: { json: any; ms: number } | undefined) => void;
    const upPromise = new Promise<{ json: any; ms: number } | undefined>((r) => (resolveUp = r));
    if (cand && !streaming) void mirror(cand, api, parsed, upPromise).catch((e) => console.warn(`[proxy] mirror failed: ${e}`));

    const t0 = performance.now();
    try {
      const up = await fetch(upstream + rest, { method: req.method, headers, body: body?.length ? new Uint8Array(body) : undefined });
      const outHeaders: Record<string, string> = {};
      up.headers.forEach((v, k) => {
        if (!DROP_RES.has(k.toLowerCase())) outHeaders[k] = v;
      });
      if (streaming || !up.body) {
        resolveUp(undefined);
        res.writeHead(up.status, outHeaders);
        if (up.body) Readable.fromWeb(up.body as any).pipe(res);
        else res.end();
        return;
      }
      const buf = Buffer.from(await up.arrayBuffer());
      const ms = performance.now() - t0;
      res.writeHead(up.status, outHeaders);
      res.end(buf);
      let json: any;
      try {
        json = up.ok ? JSON.parse(buf.toString("utf8")) : undefined;
      } catch {
        json = undefined;
      }
      resolveUp(json ? { json, ms } : undefined);
    } catch (e) {
      resolveUp(undefined);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: `jev-swap proxy: upstream request failed: ${e}` } }));
    }
  }

  function snapshot() {
    const cards = candidates.map((c) => {
      const all = mirrors.get(c.id)!;
      type Done = Mirror & Required<Pick<Mirror, "perField" | "conf" | "jevMs">>;
      const ok = all.filter((m): m is Done => !m.error && !!m.perField);
      const { curve, recommended } = curveFor(ok, o.target);
      const fieldAgreement: Record<string, number | null> = {};
      for (const f of c.fields) {
        const vals = ok.map((m) => m.perField[f.name]).filter((v): v is boolean => v !== null);
        fieldAgreement[f.name] = vals.length ? vals.filter(Boolean).length / vals.length : null;
      }
      const threshold = applied.get(c.id) ?? recommended?.threshold ?? null;
      const llmKnown = ok.every((m) => m.llmCost !== null) && ok.length > 0;
      const llmCost = llmKnown ? ok.reduce((s, m) => s + (m.llmCost ?? 0), 0) : null;
      const jevCost = ok.reduce((s, m) => s + (m.jevCost ?? 0), 0);
      const hybridCost = llmKnown && threshold !== null
        ? jevCost + ok.filter((m) => m.conf < threshold).reduce((s, m) => s + (m.llmCost ?? 0), 0)
        : null;
      const status = ok.length < o.minSamples ? "collecting" : recommended ? "ready" : "below-target";
      return {
        id: c.id,
        file: c.file,
        line: c.line,
        language: c.language,
        fields: c.fields.map((f) => ({ name: f.name, kind: f.kind })),
        samples: ok.length,
        errors: all.length - ok.length,
        exact: ok.length ? ok.filter((m) => m.exact).length / ok.length : null,
        fieldAgreement,
        llmP50: median(ok.map((m) => m.llmMs)),
        jevP50: median(ok.map((m) => m.jevMs)),
        curve,
        recommended,
        applied: applied.get(c.id) ?? null,
        status,
        llmCost,
        jevCost,
        hybridCost,
        saved: llmCost !== null && hybridCost !== null ? llmCost - hybridCost : null,
      };
    });
    const everything = [...mirrors.values()].flat().sort((a, b) => b.n - a.n);
    const elapsedMin = (Date.now() - started) / 60000;
    const saved = cards.reduce((s, c) => s + (c.saved ?? 0), 0);
    return {
      mode: o.mock ? "mock" : "live",
      target: o.target,
      minSamples: o.minSamples,
      startedAt: started,
      pricesKnown: o.llmPriceIn !== undefined && o.llmPriceOut !== undefined,
      baseUrls: {
        openai: `http://${shownHost}:${o.port}/openai/v1`,
        anthropic: `http://${shownHost}:${o.port}/anthropic`,
      },
      counters,
      totals: {
        saved,
        savedPerMonth: elapsedMin > 0.5 ? (saved / elapsedMin) * 60 * 24 * 30 : null,
        exact: (() => {
          const ok = everything.filter((m) => m.exact !== undefined);
          return ok.length ? ok.filter((m) => m.exact).length / ok.length : null;
        })(),
        llmP50: median(everything.filter((m) => !m.error).map((m) => m.llmMs)),
        jevP50: median(everything.filter((m) => m.jevMs !== undefined).map((m) => m.jevMs!)),
      },
      cards,
      feed: everything.slice(0, 25).map(({ n, at, candidate, llmMs, jevMs, exact, conf, error }) => ({ n, at, candidate, llmMs, jevMs, exact, conf, error })),
      disagreements: everything.filter((m) => m.exact === false).slice(0, 40).map(({ n, at, candidate, state, llm, jev, conf }) => ({ n, at, candidate, state, llm, jev, conf })),
    };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const p = url.pathname;
    try {
      if (p.startsWith("/openai/")) return await forward("openai", req, res, p.slice("/openai".length) + url.search);
      if (p.startsWith("/anthropic/")) return await forward("anthropic", req, res, p.slice("/anthropic".length) + url.search);
      if (p === "/" && req.method === "GET") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(dashboardHtml);
      }
      if (p === "/api/state" && req.method === "GET") {
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        return res.end(JSON.stringify(snapshot()));
      }
      const apply = p.match(/^\/api\/apply\/([^/]+)$/);
      if (apply && req.method === "POST") {
        const id = decodeURIComponent(apply[1]);
        const card = snapshot().cards.find((c) => c.id === id);
        let status = 200;
        let body: Record<string, unknown>;
        if (!byId.has(id) || !card) [status, body] = [404, { error: "unknown candidate" }];
        else if (o.mock) [status, body] = [409, { error: "Simulated run: thresholds are not written from mock data." }];
        else if (card.status !== "ready" || !card.recommended) [status, body] = [409, { error: "Not ready: needs more samples or doesn't meet the target yet." }];
        else {
          const file = applyThreshold(o.out, id, card.recommended.threshold);
          if (!file) [status, body] = [404, { error: "Generated module not found. Run `jev-swap convert` first." }];
          else {
            applied.set(id, card.recommended.threshold);
            body = { ok: true, file, threshold: card.recommended.threshold };
          }
        }
        res.writeHead(status, { "content-type": "application/json" });
        return res.end(JSON.stringify(body));
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found. Point your SDK at /openai/v1 or /anthropic.");
    } catch (e) {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(e));
    }
  });

  server.listen(o.port, o.host, () => {
    const s = snapshot();
    console.log(`jev-swap proxy ${o.mock ? "(SIMULATED Jev) " : ""}listening on http://${shownHost}:${o.port}`);
    console.log(`\n  Dashboard:        http://${shownHost}:${o.port}/`);
    console.log(`  OPENAI_BASE_URL=${s.baseUrls.openai}`);
    console.log(`  ANTHROPIC_BASE_URL=${s.baseUrls.anthropic}`);
    console.log(`\n  Mirroring ${candidates.length} candidate(s). Recording samples to ${samplesPath}`);
  });
  return server;
}
