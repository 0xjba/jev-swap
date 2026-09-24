import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk";

/**
 * Jev's real request profile, measured with live calls (`jev-swap oss measure-jev`):
 * billed input tokens ~= baseTokens + perQuestion * questions + stateFactor * (state chars / 4), and latency.
 */
export interface JevProfile {
  baseTokens: number;
  perQuestion: number;
  /** Jev's billed tokens for the input, per chars/4 token estimate. */
  stateFactor: number;
  p50Ms: number;
  p90Ms: number;
  calls: number;
  measuredAt: string;
  method: string;
}

const BUNDLED = fileURLToPath(new URL("../../data/jev-measure.json", import.meta.url));

/** The profile measured into the state directory, else the one bundled with the package. */
export function loadJevProfile(out?: string): JevProfile {
  const local = out ? path.join(out, "jev-measure.json") : undefined;
  const p = local && fs.existsSync(local) ? local : BUNDLED;
  return JSON.parse(fs.readFileSync(p, "utf8")).profile;
}

/** Billed Jev input tokens for a request with `questions` questions and `stateTokens` (chars/4) of input. */
export function jevRequestTokens(pr: JevProfile, questions: number, stateTokens: number): number {
  return pr.baseTokens + pr.perQuestion * questions + pr.stateFactor * stateTokens;
}

/** Least squares for y = X·b (tiny, dense). */
function lstsq(X: number[][], y: number[]): number[] {
  const k = X[0].length;
  const A = Array.from({ length: k }, (_, p) => Array.from({ length: k }, (_, q) => X.reduce((s, r) => s + r[p] * r[q], 0)));
  const b = Array.from({ length: k }, (_, p) => X.reduce((s, r, i) => s + r[p] * y[i], 0));
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = 0; j < k; j++) A[r][j] -= f * A[c][j];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/**
 * Calls Jev with 1-5 questions and short/medium/long inputs (3 reps each, after one warm-up call)
 * and fits the token profile. Needs TYPESAFE_API_KEY.
 */
export async function measureJev(reps = 3, client = new TypeSafeClient()) {
  const Q = {
    category: choice("Which team should handle this ticket?", { billing: null, technical: null, sales: null }),
    urgent: noul("Is this urgent?"),
    priority: score("Rate the priority from 1 (low) to 5 (critical).", ["1", "2", "3", "4", "5"]),
    refund: noul("Does the customer ask for a refund?"),
    sentiment: choice("What is the customer's sentiment?", { positive: null, neutral: null, negative: null }),
  };
  const base = "I was charged twice for my subscription this month and need the duplicate refunded.";
  const states = { short: "Charged twice, refund please.", medium: [base, base, base].join(" "), long: Array(12).fill(base).join(" ") };
  await client.systemOne({ state: states.short, questions: { urgent: Q.urgent } as never }); // warm-up: connection setup
  const rows: { size: string; stateChars: number; questions: number; ms: number; inTok: number }[] = [];
  for (const [size, state] of Object.entries(states)) {
    for (let n = 1; n <= 5; n++) {
      const questions = Object.fromEntries(Object.entries(Q).slice(0, n));
      for (let r = 0; r < reps; r++) {
        const t0 = performance.now();
        const res: any = await client.systemOne({ state, questions: questions as never });
        rows.push({ size, stateChars: state.length, questions: n, ms: Math.round(performance.now() - t0), inTok: res.usage.input_tokens });
      }
    }
  }
  const [a, b, c] = lstsq(rows.map((r) => [1, r.questions, r.stateChars / 4]), rows.map((r) => r.inTok));
  const ms = rows.map((r) => r.ms);
  const profile: JevProfile = {
    baseTokens: Math.round(a), perQuestion: Math.round(b), stateFactor: Math.round(c * 100) / 100,
    p50Ms: pct(ms, 0.5), p90Ms: pct(ms, 0.9), calls: rows.length, measuredAt: new Date().toISOString(),
    method: "Live TypeSafe Jev calls (1-5 questions x short/medium/long input, after a warm-up call), timed end to end from one client; tokens are Jev's billed usage.input_tokens.",
  };
  return { profile, rows };
}
