import Anthropic from "@anthropic-ai/sdk";
import { getEncoding, getEncodingNameForModel, type Tiktoken, type TiktokenModel } from "js-tiktoken";
import { buildQuestions } from "../questions.js";
import type { Candidate } from "../types.js";

export type CountMethod = "tiktoken:o200k_base" | "tiktoken:cl100k_base" | "anthropic:count_tokens" | "estimate:chars/4";

export interface TokenCount { tokens: number; method: CountMethod }

/** Rough, labelled estimate for text we have no tokenizer for (~4 characters per token). */
export const estimateTokens = (text: string): TokenCount => ({ tokens: Math.ceil(text.length / 4), method: "estimate:chars/4" });

const encoders = new Map<string, Tiktoken>();

function openaiEncoder(model: string): { enc: Tiktoken; method: CountMethod } | undefined {
  let name: string;
  try {
    // Only models js-tiktoken knows. Newer model families fall back to a labelled estimate.
    name = getEncodingNameForModel(model as TiktokenModel);
  } catch {
    return undefined;
  }
  if (name !== "o200k_base" && name !== "cl100k_base") return undefined;
  if (!encoders.has(name)) encoders.set(name, getEncoding(name));
  return { enc: encoders.get(name)!, method: `tiktoken:${name}` };
}

let anthropicClient: Anthropic | undefined;

/**
 * Counts `text` with the provider's own tokenizer where one is available:
 * - OpenAI: the model's tiktoken encoding (local).
 * - Anthropic: POST /v1/messages/count_tokens (only when ANTHROPIC_API_KEY is set; it includes
 *   a few tokens of message framing). Retired models fail there and fall back to the estimate.
 * Everything else is estimated and labelled as such.
 */
export async function countLlmTokens(text: string, provider: "openai" | "anthropic" | undefined, model: string | undefined): Promise<TokenCount> {
  if (provider === "openai" && model) {
    const e = openaiEncoder(model);
    if (e) return { tokens: e.enc.encode(text).length, method: e.method };
  }
  if (provider === "anthropic" && model && text && process.env.ANTHROPIC_API_KEY) {
    anthropicClient ??= new Anthropic();
    try {
      const r = await anthropicClient.messages.countTokens({ model, messages: [{ role: "user", content: text }] });
      return { tokens: r.input_tokens, method: "anthropic:count_tokens" };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw e;
      /* unsupported/retired model or transient error: fall through to the estimate */
    }
  }
  return estimateTokens(text);
}

/** The static part of the prompt: prompt text with interpolated `{expr}` placeholders removed. */
export function staticPrompt(c: Candidate): string {
  let p = c.prompt ?? "";
  for (const expr of c.stateExprs) p = p.split(`{${expr}}`).join("");
  return p;
}

/**
 * The smallest output a well-behaved LLM would return for this schema: one JSON object with the
 * longest option per choice field. Free-text (dropped) fields are left out, so this is a lower bound.
 */
export function minimalOutput(c: Candidate): string {
  if (c.signal === "prompt-heuristic") return "Yes";
  const obj: Record<string, unknown> = {};
  for (const f of c.fields) {
    if (f.kind === "choice") obj[f.name] = f.options.reduce((a, b) => (b.length > a.length ? b : a), "");
    else if (f.kind === "noul") obj[f.name] = false;
    else obj[f.name] = f.max;
  }
  return JSON.stringify(obj);
}

export interface StaticTokens {
  /** Prompt text found in source, excluding interpolated user input. */
  llmPrompt: TokenCount;
  /** Minimal JSON output for the schema. */
  llmOutput: TokenCount;
  /** The Jev request jev-swap would send (questions JSON), excluding state. No public Jev tokenizer, so estimated. */
  jevStatic: TokenCount;
  promptInSource: boolean;
}

export async function staticTokens(c: Candidate, provider: "openai" | "anthropic" | undefined, model: string | undefined): Promise<StaticTokens> {
  const prompt = staticPrompt(c);
  return {
    llmPrompt: await countLlmTokens(prompt, provider, model),
    // Not via count_tokens: its message framing would inflate a few-token output and overstate LLM cost.
    llmOutput: await countLlmTokens(minimalOutput(c), provider === "openai" ? provider : undefined, model),
    jevStatic: estimateTokens(JSON.stringify({ questions: buildQuestions(c) })),
    promptInSource: prompt.trim().length > 0,
  };
}
