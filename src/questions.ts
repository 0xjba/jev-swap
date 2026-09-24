import type { Candidate, DecisionField } from "./types.js";

/** JSON question in the shape of POST /v1/systemone (docs.typesafe.ai/api). */
export type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, null> }
  | { type: "noul"; instructions: string }
  | { type: "score"; instructions: string; criteria: string[] };

/** "isSpam" / "contains_pii" / "needs-docs" -> ["is", "spam"] etc. */
function words(name: string): string[] {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_-]+/).filter(Boolean).map((w) => w.toLowerCase());
}

const VERB_LEADS: Record<string, string> = {
  is: "Is this", are: "Is this", was: "Was this", has: "Does this have", have: "Does this have",
  contains: "Does this contain", contain: "Does this contain", includes: "Does this include",
  needs: "Does this need", need: "Does this need", requires: "Does this require",
  should: "Should this", can: "Can this", uses: "Does this use", mentions: "Does this mention",
};

/**
 * A short, gut-check question from the field's name, for fields without a description.
 * Jev gets the input separately as state, so repeating the call's whole prompt per field only adds tokens.
 */
export function questionFromName(f: DecisionField): string {
  const w = words(f.name);
  const label = w.join(" ");
  if (f.kind === "choice") {
    return f.name === "choice" ? "Which option fits best?" : `Which ${label} applies?`;
  }
  if (f.kind === "noul") {
    const lead = VERB_LEADS[w[0]];
    if (lead && w.length > 1) return `${lead} ${w.slice(1).join(" ")}?`;
    return f.name === "answer" ? "Yes or no?" : `Is this ${label}?`;
  }
  return `Rate the ${label} from ${f.min} (lowest) to ${f.max} (highest).`;
}

export function instructionsFor(c: Candidate, f: DecisionField): string {
  if (f.description) return f.description;
  if (c.signal === "prompt-heuristic" && c.prompt) {
    // The prompt is the question itself; the input it interpolates goes to Jev as state.
    let p = c.prompt;
    for (const e of c.stateExprs) p = p.split(`{${e}}`).join("");
    return p.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return questionFromName(f);
}

export function scoreLabels(f: Extract<DecisionField, { kind: "score" }>): string[] {
  return Array.from({ length: f.max - f.min + 1 }, (_, i) => String(f.min + i));
}

export function buildQuestions(c: Candidate): Record<string, JevQuestion> {
  const q: Record<string, JevQuestion> = {};
  for (const f of c.fields) {
    const instructions = instructionsFor(c, f);
    if (f.kind === "choice") q[f.name] = { type: "choice", instructions, criteria: Object.fromEntries(f.options.map((o) => [o, null])) };
    else if (f.kind === "noul") q[f.name] = { type: "noul", instructions };
    else q[f.name] = { type: "score", instructions, criteria: scoreLabels(f) };
  }
  return q;
}

type Answer = { type: string; choice?: string; noul?: number; score?: number; confidence?: number };

export function answerValue(f: DecisionField, a: Answer): string | boolean | number {
  if (f.kind === "choice") return a.choice!;
  if (f.kind === "noul") return a.noul! >= 0.5;
  return f.min + Math.round(a.score!);
}

/** Choice/Score return `confidence`. Noul does not, so we derive |p - 0.5| * 2. */
export function answerConfidence(f: DecisionField, a: Answer): number {
  if (f.kind === "noul") return Math.abs(a.noul! - 0.5) * 2;
  return a.confidence ?? 0;
}

export function normalizeLlm(f: DecisionField, v: unknown): string | boolean | number | undefined {
  if (v === undefined || v === null) return undefined;
  if (f.kind === "noul") {
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toLowerCase().replace(/[.!]$/, "");
    if (["yes", "true", "1", "y"].includes(s)) return true;
    if (["no", "false", "0", "n"].includes(s)) return false;
    return undefined;
  }
  if (f.kind === "score") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }
  return String(v);
}
