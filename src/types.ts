export type DecisionField =
  | { name: string; kind: "choice"; options: string[]; description?: string }
  | { name: string; kind: "noul"; description?: string }
  | { name: string; kind: "score"; min: number; max: number; description?: string };

/**
 * The model a call uses. `id` is set when it could be resolved statically:
 * a literal in the call, a literal fallback next to an env var, or the env var's value in a
 * committed .env example file. `expr` is the source text when it wasn't a plain literal.
 */
export interface ModelRef {
  id?: string;
  source: "literal" | "default" | "env-example" | "unknown";
  expr?: string;
  envVar?: string;
}

export interface Candidate {
  id: string;
  language: "ts" | "python";
  file: string;
  line: number;
  provider: "openai" | "anthropic" | "ai-sdk" | "langchain";
  api: string;
  signal: "schema" | "prompt-heuristic";
  fields: DecisionField[];
  /** Free-text/non-decision output fields Jev cannot produce. */
  droppedFields: string[];
  prompt?: string;
  stateExprs: string[];
  model?: ModelRef;
  snippet: string;
}

export interface SampleRow {
  candidate: string;
  state: unknown;
  llm: Record<string, unknown>;
  llm_usage?: { input_tokens: number; output_tokens: number };
}
