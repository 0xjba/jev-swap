import type { Candidate } from "../types.js";

export type Api = "openai" | "anthropic";

type Json = any;

// ---------- request side ----------

function textOf(content: Json): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** System/instruction text and the last user message, across OpenAI chat, OpenAI Responses and Anthropic Messages. */
export function extractText(api: Api, body: Json): { system: string; user: string } {
  const system: string[] = [];
  let user = "";
  if (api === "anthropic") {
    system.push(textOf(body.system));
  } else if (typeof body.instructions === "string") {
    system.push(body.instructions); // Responses API
  }
  const msgs: Json[] = Array.isArray(body.messages) ? body.messages : Array.isArray(body.input) ? body.input : [];
  for (const m of msgs) {
    if (m?.role === "system" || m?.role === "developer") system.push(textOf(m.content));
    else if (m?.role === "user") {
      const t = textOf(m.content);
      if (t) user = t;
    }
  }
  if (!user && typeof body.input === "string") user = body.input;
  return { system: system.filter(Boolean).join("\n\n"), user };
}

/** Every `properties` key set and every string `enum` found anywhere in the request (schemas, tools). */
function collectSchemas(v: Json, keysets: string[][], enums: string[][], depth = 0): void {
  if (depth > 25 || v === null || typeof v !== "object") return;
  if (Array.isArray(v)) {
    for (const x of v) collectSchemas(x, keysets, enums, depth + 1);
    return;
  }
  if (v.properties && typeof v.properties === "object" && !Array.isArray(v.properties)) keysets.push(Object.keys(v.properties));
  if (Array.isArray(v.enum) && v.enum.length && v.enum.every((e: unknown) => typeof e === "string")) enums.push(v.enum);
  for (const [k, x] of Object.entries(v)) {
    if (k === "messages" || k === "input" || k === "system") continue; // skip conversation text
    collectSchemas(x, keysets, enums, depth + 1);
  }
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Longest literal chunk of a candidate prompt, ignoring {expr} placeholders. */
function promptAnchor(p: string): string {
  return p.split(/\{[^}]*\}/).map(norm).sort((a, b) => b.length - a.length)[0] ?? "";
}

function providerFits(c: Candidate, api: Api): boolean {
  if (c.provider === "ai-sdk" || c.provider === "langchain") return true; // either upstream
  return c.provider === api;
}

export function matchCandidate(candidates: Candidate[], api: Api, body: Json): Candidate | undefined {
  const pool = candidates.filter((c) => providerFits(c, api));
  const keysets: string[][] = [];
  const enums: string[][] = [];
  collectSchemas(body, keysets, enums);

  // 1. schema key set equals the candidate's output fields (decision + dropped)
  for (const c of pool) {
    if (c.signal !== "schema") continue;
    const names = [...c.fields.map((f) => f.name), ...c.droppedFields];
    if (keysets.some((k) => sameSet(k, names))) return c;
  }
  // 2. single-choice candidates: enum values match (wrappers like Output.choice rename the key)
  for (const c of pool) {
    const f = c.fields[0];
    if (c.fields.length === 1 && f.kind === "choice" && enums.some((e) => sameSet(e, f.options))) return c;
  }
  // 3. prompt-heuristic candidates: no schema, match the prompt text
  if (keysets.length === 0) {
    const { system, user } = extractText(api, body);
    const hay = norm(`${system}\n${user}`);
    for (const c of pool) {
      if (c.signal !== "prompt-heuristic" || !c.prompt) continue;
      const anchor = promptAnchor(c.prompt);
      if (anchor.length >= 12 && hay.includes(anchor)) return c;
    }
  }
  return undefined;
}

// ---------- response side ----------

function tryJson(s: unknown): Json {
  if (typeof s !== "string") return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** The LLM's decision as { field: value }, from a non-streaming response body. */
export function extractAnswer(api: Api, c: Candidate, res: Json): Record<string, unknown> | undefined {
  let obj: Json;
  let text: string | undefined;
  if (api === "anthropic") {
    const blocks: Json[] = Array.isArray(res?.content) ? res.content : [];
    obj = blocks.find((b) => b?.type === "tool_use")?.input;
    text = blocks.filter((b) => b?.type === "text").map((b) => b.text).join("");
  } else if (Array.isArray(res?.choices)) {
    const msg = res.choices[0]?.message ?? {};
    obj = tryJson(msg.tool_calls?.[0]?.function?.arguments);
    text = typeof msg.content === "string" ? msg.content : undefined;
  } else if (Array.isArray(res?.output)) {
    const call = res.output.find((o: Json) => o?.type === "function_call");
    obj = tryJson(call?.arguments);
    text = res.output
      .filter((o: Json) => o?.type === "message")
      .flatMap((o: Json) => (Array.isArray(o.content) ? o.content : []))
      .map((p: Json) => p?.text ?? "")
      .join("");
  }
  if (!obj && text) obj = tryJson(text.trim());

  if (c.signal === "prompt-heuristic") {
    return text !== undefined ? { [c.fields[0].name]: text.trim() } : undefined;
  }
  if (!obj || typeof obj !== "object") return undefined;
  // Single-field candidates whose wrapper renamed the key (e.g. { result: "positive" }).
  if (c.fields.length === 1 && !(c.fields[0].name in obj)) {
    const vals = Object.values(obj);
    if (vals.length === 1) return { [c.fields[0].name]: vals[0] };
  }
  return obj;
}

export function extractUsage(res: Json): { input_tokens: number; output_tokens: number } | undefined {
  const u = res?.usage;
  if (!u) return undefined;
  const input = u.prompt_tokens ?? u.input_tokens;
  const output = u.completion_tokens ?? u.output_tokens;
  return typeof input === "number" && typeof output === "number" ? { input_tokens: input, output_tokens: output } : undefined;
}
