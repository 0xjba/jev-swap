import { TypeSafeClient } from "@typesafe-ai/sdk";
import { answerConfidence, answerValue, buildQuestions, normalizeLlm } from "./questions.js";
import type { Candidate, SampleRow } from "./types.js";

export const THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95];

export interface ShadowOptions {
  mock: boolean;
  mockAgreement: number;
  target: number;
  concurrency: number;
  jevPriceIn: number; // USD per 1M input tokens
  llmPriceIn?: number;
  llmPriceOut?: number;
}

export interface CurvePoint { threshold: number; coverage: number; agreement: number | null }

export interface CandidateResult {
  id: string;
  file: string;
  line: number;
  samples: number;
  errors: number;
  fieldAgreement: Record<string, number>;
  exactAgreement: number;
  curve: CurvePoint[];
  recommended: CurvePoint | null;
  latencyMs: { p50: number; p95: number } | null;
  jevInputTokens: number;
  jevCostPerCall: number;
  llmCostPerCall: number | null;
  hybridCostPerCall: number | null;
}

// ---------- mock transport ----------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulated Jev: agrees with the recorded LLM label at `agreement` rate, with higher
 * confidence when it agrees. Exercises the real SDK request path. NOT a model.
 */
export function mockFetch(expected: Map<string, Record<string, unknown>>, agreement: number, simulateLatency = false) {
  return async (_input: unknown, init?: { body?: unknown }): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const key = JSON.stringify(body.state);
    if (simulateLatency) await new Promise((r) => setTimeout(r, 70 + rng(hash(key))() * 430));
    const exp = expected.get(key) ?? {};
    const answers: Record<string, unknown> = {};
    for (const [name, q] of Object.entries<any>(body.questions)) {
      const r = rng(hash(key + name));
      const agree = r() < agreement;
      const conf = agree ? 0.65 + 0.34 * r() : 0.2 + 0.45 * r();
      if (q.type === "choice") {
        const opts = Object.keys(q.criteria);
        const want = String(exp[name]);
        const others = opts.filter((o) => o !== want);
        const pick = agree && opts.includes(want) ? want : others[Math.floor(r() * others.length)] ?? opts[0];
        const top = 0.5 + conf / 2;
        const probs = Object.fromEntries(opts.map((o) => [o, o === pick ? top : (1 - top) / Math.max(1, opts.length - 1)]));
        answers[name] = { type: "choice", choice: pick, probabilities: probs, confidence: conf };
      } else if (q.type === "noul") {
        const want = exp[name] === true || String(exp[name]).toLowerCase() === "yes" || String(exp[name]) === "true";
        const yes = agree ? want : !want;
        answers[name] = { type: "noul", noul: yes ? 0.5 + conf / 2 : 0.5 - conf / 2 };
      } else {
        const n = q.criteria.length;
        const min = Number(q.criteria[0]);
        const idx = Math.max(0, Math.min(n - 1, Number(exp[name]) - min));
        const off = agree ? 0 : r() < 0.5 ? -1 : 1;
        const lvl = Math.max(0, Math.min(n - 1, (Number.isFinite(idx) ? idx : 0) + off));
        answers[name] = {
          type: "score",
          score: lvl + (r() - 0.5) * 0.3,
          legend: Object.fromEntries(q.criteria.map((c: string, i: number) => [String(i), c])),
          probabilities: Object.fromEntries(q.criteria.map((_: string, i: number) => [String(i), i === lvl ? 1 : 0])),
          confidence: conf,
        };
      }
    }
    const res = {
      model: "mock-jev",
      answers,
      usage: { input_tokens: Math.ceil(String(init?.body ?? "").length / 4), output_tokens: 0 },
    };
    return new Response(JSON.stringify(res), { status: 200, headers: { "content-type": "application/json" } });
  };
}

/** Compare one Jev response with the recorded LLM output. */
export function compareAnswers(c: Candidate, answers: Record<string, any>, llmOut: Record<string, unknown>) {
  const perField: Record<string, boolean | null> = {};
  const jev: Record<string, string | boolean | number> = {};
  let conf = 1;
  for (const f of c.fields) {
    const a = answers[f.name];
    const llm = normalizeLlm(f, llmOut[f.name]);
    jev[f.name] = answerValue(f, a);
    perField[f.name] = llm === undefined ? null : jev[f.name] === llm;
    conf = Math.min(conf, answerConfidence(f, a));
  }
  return { perField, conf, jev };
}

export const isExact = (perField: Record<string, boolean | null>) =>
  Object.values(perField).every((v) => v !== false) && Object.values(perField).some((v) => v !== null);

/** Coverage/agreement at each threshold, and the lowest threshold meeting the target. */
export function curveFor(runs: { conf: number; perField: Record<string, boolean | null> }[], target: number) {
  const curve: CurvePoint[] = THRESHOLDS.map((t) => {
    const covered = runs.filter((r) => r.conf >= t);
    return {
      threshold: t,
      coverage: runs.length ? covered.length / runs.length : 0,
      agreement: covered.length ? covered.filter((r) => isExact(r.perField)).length / covered.length : null,
    };
  });
  const recommended = curve.find((p) => p.agreement !== null && p.agreement >= target && p.coverage > 0) ?? null;
  return { curve, recommended };
}

// ---------- runner ----------

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export async function shadow(candidates: Candidate[], rows: SampleRow[], o: ShadowOptions): Promise<CandidateResult[]> {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const expected = new Map(rows.map((r) => [JSON.stringify(r.state), r.llm]));
  const client = o.mock
    ? new TypeSafeClient({ apiKey: "mock", fetch: mockFetch(expected, o.mockAgreement) as never, logLevel: "error" })
    : new TypeSafeClient();

  const results: CandidateResult[] = [];
  for (const c of candidates) {
    const mine = rows.filter((r) => r.candidate === c.id);
    if (!mine.length) continue;
    const questions = buildQuestions(c);

    const runs = await pool(mine, o.concurrency, async (row) => {
      const t0 = performance.now();
      try {
        const res: any = await client.systemOne({ state: row.state as never, questions: questions as never });
        const ms = performance.now() - t0;
        const { perField, conf } = compareAnswers(c, res.answers, row.llm);
        const llmCost = row.llm_usage && o.llmPriceIn !== undefined && o.llmPriceOut !== undefined
          ? (row.llm_usage.input_tokens * o.llmPriceIn + row.llm_usage.output_tokens * o.llmPriceOut) / 1e6
          : null;
        return { ok: true as const, ms, perField, conf, inTok: res.usage.input_tokens as number, llmCost };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    });

    const ok = runs.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
    const errors = runs.length - ok.length;
    const exact = (r: (typeof ok)[number]) => isExact(r.perField);
    const fieldAgreement: Record<string, number> = {};
    for (const f of c.fields) {
      const vals = ok.map((r) => r.perField[f.name]).filter((v): v is boolean => v !== null);
      fieldAgreement[f.name] = vals.length ? vals.filter(Boolean).length / vals.length : NaN;
    }
    const { curve, recommended } = curveFor(ok, o.target);

    const jevInputTokens = ok.reduce((s, r) => s + r.inTok, 0);
    const jevCostPerCall = ok.length ? (jevInputTokens / ok.length) * o.jevPriceIn / 1e6 : 0;
    const llmCosts = ok.map((r) => r.llmCost).filter((x): x is number => x !== null);
    const llmCostPerCall = llmCosts.length === ok.length && ok.length ? llmCosts.reduce((a, b) => a + b, 0) / ok.length : null;
    const hybridCostPerCall = llmCostPerCall !== null && recommended
      ? jevCostPerCall + llmCostPerCall * (1 - recommended.coverage)
      : null;

    results.push({
      id: c.id,
      file: c.file,
      line: c.line,
      samples: mine.length,
      errors,
      fieldAgreement,
      exactAgreement: ok.length ? ok.filter(exact).length / ok.length : 0,
      curve,
      recommended,
      latencyMs: o.mock || !ok.length ? null : { p50: pct(ok.map((r) => r.ms), 50), p95: pct(ok.map((r) => r.ms), 95) },
      jevInputTokens,
      jevCostPerCall,
      llmCostPerCall,
      hybridCostPerCall,
    });
    if (errors) console.warn(`[${c.id}] ${errors} request(s) failed; first: ${(runs.find((r) => !r.ok) as any)?.error}`);
  }
  const unknown = [...new Set(rows.map((r) => r.candidate).filter((id) => !byId.has(id)))];
  if (unknown.length) console.warn(`Samples reference unknown candidates (skipped): ${unknown.join(", ")}`);
  return results;
}
