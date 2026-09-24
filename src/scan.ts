import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Node, Project, SyntaxKind, type CallExpression } from "ts-morph";
import fs from "node:fs";
import type { Candidate, DecisionField, ModelRef } from "./types.js";

const OPENAI_RE = /\.(chat\.completions\.(create|parse)|responses\.(create|parse))$/;
const ANTHROPIC_RE = /\.messages\.(create|parse)$/;
const AISDK_RE = /^(generateText|generateObject|streamText|streamObject)$/;
const ZOD_NS = new Set(["z", "zod"]);
const PROMPT_KEYS = new Set(["content", "system", "prompt", "instructions", "input", "text"]);
// Both words must appear: "reply with ONLY the title, no quotes" is not a yes/no question.
const YES_NO_RE = /\b(yes or no|yes\/no|true or false)\b|\b(answer|respond|reply)\b[^.\n]{0,40}(\byes\b[^.\n]{0,60}\bno\b|\bno\b[^.\n]{0,60}\byes\b)/i;

type Parsed = { fields: DecisionField[]; dropped: string[] };

// ---------- node helpers ----------

function unwrap(n: Node, depth = 0): Node {
  let cur = n;
  for (let i = 0; i < 10; i++) {
    if (Node.isAsExpression(cur) || Node.isParenthesizedExpression(cur) || Node.isSatisfiesExpression(cur) || Node.isNonNullExpression(cur)) {
      cur = cur.getExpression();
    } else if (Node.isIdentifier(cur) && depth < 5) {
      const init = resolveIdentifier(cur);
      if (!init) return cur;
      return unwrap(init, depth + 1);
    } else return cur;
  }
  return cur;
}

function resolveIdentifier(id: Node): Node | undefined {
  if (!Node.isIdentifier(id)) return undefined;
  try {
    for (const def of id.getDefinitionNodes()) {
      if (Node.isVariableDeclaration(def)) return def.getInitializer();
    }
  } catch {
    /* unresolved */
  }
  return undefined;
}

function strValue(n: Node | undefined): string | undefined {
  if (!n) return undefined;
  const u = unwrap(n);
  if (Node.isStringLiteral(u) || Node.isNoSubstitutionTemplateLiteral(u)) return u.getLiteralText();
  return undefined;
}

function numValue(n: Node | undefined): number | undefined {
  if (!n) return undefined;
  const u = unwrap(n);
  if (Node.isNumericLiteral(u)) return u.getLiteralValue();
  if (Node.isPrefixUnaryExpression(u) && u.getOperatorToken() === SyntaxKind.MinusToken) {
    const v = numValue(u.getOperand());
    return v === undefined ? undefined : -v;
  }
  return undefined;
}

function propName(p: Node): string | undefined {
  if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) return p.getName().replace(/^["'`]|["'`]$/g, "");
  return undefined;
}

function getProp(obj: Node, name: string): Node | undefined {
  if (!Node.isObjectLiteralExpression(obj)) return undefined;
  for (const p of obj.getProperties()) {
    if (propName(p) !== name) continue;
    if (Node.isPropertyAssignment(p)) return p.getInitializer();
    if (Node.isShorthandPropertyAssignment(p)) return p.getNameNode();
  }
  return undefined;
}

function stringArray(n: Node | undefined): string[] | undefined {
  if (!n) return undefined;
  const u = unwrap(n);
  if (Node.isArrayLiteralExpression(u)) {
    const out = u.getElements().map(strValue);
    return out.every((s): s is string => s !== undefined) && out.length > 0 ? out : undefined;
  }
  if (Node.isObjectLiteralExpression(u)) {
    // zod 4: z.enum({ A: "a", B: "b" })
    const out = u.getProperties().map((p) => (Node.isPropertyAssignment(p) ? strValue(p.getInitializer()) : undefined));
    return out.every((s): s is string => s !== undefined) && out.length > 0 ? out : undefined;
  }
  return undefined;
}

// ---------- zod ----------

interface ZodChain { base: string; baseArgs: Node[]; mods: { name: string; args: Node[] }[] }

function parseZodChain(n: Node): ZodChain | undefined {
  let cur = unwrap(n);
  const mods: ZodChain["mods"] = [];
  while (Node.isCallExpression(cur)) {
    const callee = cur.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return undefined;
    const target = callee.getExpression();
    if (Node.isIdentifier(target) && ZOD_NS.has(target.getText())) {
      return { base: callee.getName(), baseArgs: cur.getArguments(), mods };
    }
    mods.push({ name: callee.getName(), args: cur.getArguments() });
    cur = unwrap(target);
  }
  return undefined;
}

function zodField(name: string, n: Node): DecisionField | undefined {
  const c = parseZodChain(n);
  if (!c) return undefined;
  const mod = (m: string) => c.mods.find((x) => x.name === m);
  const description = strValue(mod("describe")?.args[0]);
  switch (c.base) {
    case "enum": {
      const options = stringArray(c.baseArgs[0]);
      return options ? { name, kind: "choice", options, description } : undefined;
    }
    case "union": {
      const arr = c.baseArgs[0] ? unwrap(c.baseArgs[0]) : undefined;
      if (!arr || !Node.isArrayLiteralExpression(arr)) return undefined;
      const options = arr.getElements().map((e) => {
        const lc = parseZodChain(e);
        return lc?.base === "literal" ? strValue(lc.baseArgs[0]) : undefined;
      });
      return options.every((o): o is string => o !== undefined) ? { name, kind: "choice", options, description } : undefined;
    }
    case "boolean":
      return { name, kind: "noul", description };
    case "number":
    case "int": {
      const isInt = c.base === "int" || !!mod("int");
      const min = numValue((mod("min") ?? mod("gte"))?.args[0]);
      const max = numValue((mod("max") ?? mod("lte"))?.args[0]);
      return scoreField(name, isInt, min, max, description);
    }
    default:
      return undefined;
  }
}

function scoreField(name: string, isInt: boolean, min?: number, max?: number, description?: string): DecisionField | undefined {
  // Jev Score accepts 2..10 ordered levels.
  if (!isInt || min === undefined || max === undefined) return undefined;
  const levels = max - min + 1;
  return levels >= 2 && levels <= 10 ? { name, kind: "score", min, max, description } : undefined;
}

function zodObject(n: Node): Parsed | undefined {
  const c = parseZodChain(n);
  if (!c || c.base !== "object") return undefined;
  const shape = c.baseArgs[0] ? unwrap(c.baseArgs[0]) : undefined;
  if (!shape || !Node.isObjectLiteralExpression(shape)) return undefined;
  const out: Parsed = { fields: [], dropped: [] };
  for (const p of shape.getProperties()) {
    const name = propName(p);
    const init = name ? getProp(shape, name) : undefined;
    if (!name || !init) continue;
    const f = zodField(name, init);
    f ? out.fields.push(f) : out.dropped.push(name);
  }
  return out;
}

// ---------- JSON schema ----------

function jsonSchemaObject(n: Node): Parsed | undefined {
  if (!Node.isObjectLiteralExpression(n)) return undefined;
  const propsNode = getProp(n, "properties");
  const props = propsNode ? unwrap(propsNode) : undefined;
  if (!props || !Node.isObjectLiteralExpression(props)) return undefined;
  const out: Parsed = { fields: [], dropped: [] };
  for (const p of props.getProperties()) {
    const name = propName(p);
    const def = name ? getProp(props, name) : undefined;
    const d = def ? unwrap(def) : undefined;
    if (!name || !d || !Node.isObjectLiteralExpression(d)) {
      if (name) out.dropped.push(name);
      continue;
    }
    const description = strValue(getProp(d, "description"));
    const type = strValue(getProp(d, "type"));
    const options = stringArray(getProp(d, "enum"));
    let f: DecisionField | undefined;
    if (options) f = { name, kind: "choice", options, description };
    else if (type === "boolean") f = { name, kind: "noul", description };
    else if (type === "integer") f = scoreField(name, true, numValue(getProp(d, "minimum")), numValue(getProp(d, "maximum")), description);
    f ? out.fields.push(f) : out.dropped.push(name);
  }
  return out;
}

// ---------- schema search inside call args ----------

function directSchema(n: Node): Parsed | undefined {
  if (Node.isCallExpression(n)) {
    const z = zodObject(n);
    if (z) return z;
    const callee = n.getExpression().getText();
    if (/(^|\.)Output\.choice$/.test(callee)) {
      const arg = n.getArguments()[0] ? unwrap(n.getArguments()[0]) : undefined;
      const options = arg ? stringArray(getProp(arg, "options") ?? getProp(arg, "choices")) : undefined;
      if (options) return { fields: [{ name: "choice", kind: "choice", options }], dropped: [] };
    }
  }
  if (Node.isObjectLiteralExpression(n)) {
    // AI SDK legacy: generateObject({ output: "enum", enum: [...] })
    if (strValue(getProp(n, "output")) === "enum") {
      const options = stringArray(getProp(n, "enum"));
      if (options) return { fields: [{ name: "choice", kind: "choice", options }], dropped: [] };
    }
    return jsonSchemaObject(n);
  }
  return undefined;
}

function findSchema(n: Node, depth = 0, seen = new Set<Node>()): Parsed | undefined {
  if (depth > 10) return undefined;
  const u = unwrap(n);
  if (seen.has(u)) return undefined;
  seen.add(u);
  const direct = directSchema(u);
  if (direct && direct.fields.length + direct.dropped.length > 0) return direct;
  let children: Node[] = [];
  if (Node.isCallExpression(u)) children = u.getArguments();
  else if (Node.isObjectLiteralExpression(u)) children = u.getProperties().flatMap((p) => (Node.isPropertyAssignment(p) ? [p.getInitializer()!] : Node.isShorthandPropertyAssignment(p) ? [p.getNameNode()] : []));
  else if (Node.isArrayLiteralExpression(u)) children = u.getElements();
  for (const c of children) {
    if (!c) continue;
    const r = findSchema(c, depth + 1, seen);
    if (r) return r;
  }
  return undefined;
}

/**
 * Tool/function definitions describe what the model MAY call, not what this call returns, unless
 * tool_choice / toolChoice / function_call forces one. Unknown (dynamic) choices count as forced.
 */
function toolsAreOutput(obj: Node, choiceKeys: string[]): boolean {
  for (const k of choiceKeys) {
    const tc = getProp(obj, k);
    if (!tc) continue;
    const u = unwrap(tc);
    const lit = strValue(u);
    if (lit !== undefined) return lit === "required" || lit === "any";
    if (Node.isObjectLiteralExpression(u)) {
      const t = strValue(getProp(u, "type"));
      return t === undefined ? getProp(u, "name") !== undefined : ["tool", "any", "function"].includes(t);
    }
    return true;
  }
  return false;
}

function schemaFromCallArg(a: Node): Parsed | undefined {
  const u = unwrap(a);
  if (!Node.isObjectLiteralExpression(u)) return findSchema(a);
  const skip = new Set<string>();
  if (getProp(u, "tools") && !toolsAreOutput(u, ["tool_choice", "toolChoice"])) skip.add("tools");
  if (getProp(u, "functions") && !toolsAreOutput(u, ["function_call"])) skip.add("functions");
  if (!skip.size) return findSchema(a);
  for (const p of u.getProperties()) {
    const name = propName(p);
    if (!name || skip.has(name)) continue;
    const init = getProp(u, name);
    const r = init ? findSchema(init) : undefined;
    if (r) return r;
  }
  return undefined;
}

// ---------- raw HTTP calls (fetch / axios / ky / got ...) ----------

const HTTP_CALLEE_RE = /^(fetch|\$fetch|ofetch|axios|axios\.(post|request)|[\w$]+\.post)$/;
const LLM_URL_RE = /api\.openai\.com|api\.anthropic\.com|openrouter\.ai\/api|\/v1\/chat\/completions|\/chat\/completions|\/v1\/responses|\/v1\/messages/;

/** A URL's text: literal, or template/concatenation source (keeps literal path parts like `${BASE}/chat/completions`). */
function urlText(n: Node | undefined): string {
  if (!n) return "";
  const u = unwrap(n);
  return strValue(u) ?? u.getText();
}

/** JSON.stringify(x) -> x; anything else unchanged. */
function unstringify(n: Node | undefined): Node | undefined {
  if (!n) return undefined;
  const u = unwrap(n);
  if (Node.isCallExpression(u) && u.getExpression().getText().replace(/\s+/g, "") === "JSON.stringify") {
    const a = u.getArguments()[0];
    return a ? unwrap(a) : undefined;
  }
  return u;
}

export function httpRequest(call: CallExpression, callee: string): { provider: Candidate["provider"]; api: string; body: Node } | undefined {
  if (!HTTP_CALLEE_RE.test(callee)) return undefined;
  const args = call.getArguments();
  let urlNode: Node | undefined = args[0];
  let body: Node | undefined;
  const first = args[0] ? unwrap(args[0]) : undefined;
  if ((callee === "axios" || callee === "axios.request") && first && Node.isObjectLiteralExpression(first)) {
    // axios({ url, method, data })
    urlNode = getProp(first, "url");
    body = unstringify(getProp(first, "data"));
  } else {
    const second = args[1] ? unwrap(args[1]) : undefined;
    if (second && Node.isObjectLiteralExpression(second)) {
      const inner = getProp(second, "body") ?? getProp(second, "json") ?? getProp(second, "data");
      body = inner ? unstringify(inner) : second; // fetch/ky/got options, or axios.post(url, data)
    } else body = unstringify(args[1]);
  }
  if (!body || !Node.isObjectLiteralExpression(body)) return undefined;
  const url = urlText(urlNode);
  const llmUrl = LLM_URL_RE.test(url);
  const has = (k: string) => getProp(body!, k) !== undefined;
  if (!((has("model") && has("messages")) || (llmUrl && (has("messages") || has("input"))))) return undefined;
  const provider: Candidate["provider"] = /anthropic|\/v1\/messages/.test(url) ? "anthropic" : "openai";
  const path = url.match(/\/v1\/[a-z/]+|\/chat\/completions/);
  return { provider, api: `http ${path ? path[0] : "POST"}`, body };
}

// ---------- prompt / state extraction ----------

function extractPrompt(call: CallExpression, extraRoots: Node[] = []): { prompt?: string; stateExprs: string[] } {
  const texts: string[] = [];
  const stateExprs: string[] = [];
  const seen = new Set<Node>();
  for (const arg of [...call.getArguments(), ...extraRoots]) {
    const root = unwrap(arg);
    for (const pa of root.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (seen.has(pa)) continue;
      seen.add(pa);
      if (!PROMPT_KEYS.has(propName(pa) ?? "")) continue;
      const raw = pa.getInitializer();
      if (!raw) continue;
      const lit = strValue(raw);
      if (lit !== undefined) { texts.push(lit); continue; }
      if (Node.isTemplateExpression(raw)) {
        let t = raw.getHead().getLiteralText();
        for (const span of raw.getTemplateSpans()) {
          const expr = span.getExpression().getText();
          stateExprs.push(expr);
          t += `{${expr}}` + span.getLiteral().getLiteralText();
        }
        texts.push(t);
        continue;
      }
      const u = unwrap(raw);
      if (Node.isArrayLiteralExpression(u) || Node.isObjectLiteralExpression(u)) continue;
      stateExprs.push(raw.getText());
    }
  }
  return { prompt: texts.length ? texts.join("\n\n") : undefined, stateExprs: [...new Set(stateExprs)] };
}

function envVarName(n: Node): string | undefined {
  // process.env.X or process.env["X"]
  if (Node.isPropertyAccessExpression(n) && n.getExpression().getText().replace(/\s+/g, "") === "process.env") return n.getName();
  if (Node.isElementAccessExpression(n) && n.getExpression().getText().replace(/\s+/g, "") === "process.env") return strValue(n.getArgumentExpression());
  return undefined;
}

function modelRef(n: Node, depth = 0): ModelRef {
  const u = unwrap(n);
  const lit = strValue(u);
  if (lit !== undefined) return { id: lit, source: "literal" };
  const env = envVarName(u);
  if (env) return { source: "unknown", envVar: env, expr: n.getText() };
  // process.env.X ?? "gpt-4o" / process.env.X || "gpt-4o"
  if (Node.isBinaryExpression(u) && ["??", "||"].includes(u.getOperatorToken().getText())) {
    const fallback = strValue(u.getRight());
    const left = unwrap(u.getLeft());
    if (fallback !== undefined) return { id: fallback, source: "default", envVar: envVarName(left), expr: n.getText() };
  }
  // AI SDK provider functions: openai("gpt-4o"), anthropic("claude-haiku-4-5"), openai.chat("...")
  if (Node.isCallExpression(u) && depth < 2) {
    const a = u.getArguments()[0];
    if (a) return modelRef(a, depth + 1);
  }
  return { source: "unknown", expr: n.getText() };
}

function extractModel(call: CallExpression): ModelRef | undefined {
  for (const arg of call.getArguments()) {
    const m = getProp(unwrap(arg), "model");
    if (m) return modelRef(m);
  }
  return undefined;
}

function enclosingName(n: Node): string | undefined {
  for (const a of n.getAncestors()) {
    if (Node.isFunctionDeclaration(a) || Node.isMethodDeclaration(a)) return a.getName();
    if (Node.isArrowFunction(a) || Node.isFunctionExpression(a)) {
      const p = a.getParent();
      if (p && (Node.isVariableDeclaration(p) || Node.isPropertyAssignment(p))) return p.getName();
    }
  }
  return undefined;
}

// ---------- main ----------

const TS_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const TS_SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".next", "build", "coverage"]);
const CALL_HINT_RE = /\.(completions|responses|messages)\.(create|parse)\b|\b(generateText|generateObject|streamText|streamObject)\b|api\.openai\.com|api\.anthropic\.com|openrouter\.ai|\/chat\/completions|\/v1\/messages|\/v1\/responses|\bresponse_format\b|\btool_choice\b/;

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!TS_SKIP_DIRS.has(e.name)) walk(p); }
      else if (e.isFile() && TS_EXT_RE.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
    }
  };
  walk(root);
  return out;
}

export function scanTs(dir: string): Candidate[] {
  const root = path.resolve(dir);
  const project = new Project({ compilerOptions: { allowJs: true }, skipAddingFilesFromTsConfig: true });
  // Parse only files that mention an LLM call. Big monorepos (10k+ files) otherwise exhaust the heap.
  // Schemas imported from other files still resolve: the compiler follows imports on demand.
  for (const f of sourceFiles(root)) {
    let text: string;
    try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
    if (CALL_HINT_RE.test(text)) project.addSourceFileAtPath(f);
  }

  const out: Candidate[] = [];
  const ids = new Map<string, number>();
  for (const sf of project.getSourceFiles()) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText().replace(/\s+/g, "");
      let provider: Candidate["provider"] | undefined;
      let api = callee.split(".").slice(-3).join(".");
      let body: Node | undefined;
      if (OPENAI_RE.test(callee)) provider = "openai";
      else if (ANTHROPIC_RE.test(callee) && !callee.includes("threads")) provider = "anthropic";
      else if (AISDK_RE.test(callee)) provider = "ai-sdk";
      else {
        const http = httpRequest(call, callee);
        if (http) ({ provider, api, body } = http);
      }
      if (!provider) continue;

      const { prompt, stateExprs } = extractPrompt(call, body ? [body] : []);
      let parsed: Parsed | undefined;
      let signal: Candidate["signal"] = "schema";
      if (body) parsed = schemaFromCallArg(body);
      else for (const a of call.getArguments()) { parsed = schemaFromCallArg(a); if (parsed) break; }
      if ((!parsed || parsed.fields.length === 0) && prompt && YES_NO_RE.test(prompt)) {
        parsed = { fields: [{ name: "answer", kind: "noul" }], dropped: [] };
        signal = "prompt-heuristic";
      }
      if (!parsed || parsed.fields.length === 0) continue;

      const rel = path.relative(root, sf.getFilePath());
      const base = `${path.basename(rel).replace(/\.[^.]+$/, "")}-${enclosingName(call) ?? `L${call.getStartLineNumber()}`}`.replace(/[^\w.-]/g, "_");
      const n = (ids.get(base) ?? 0) + 1;
      ids.set(base, n);
      out.push({
        id: n > 1 ? `${base}-${n}` : base,
        language: "ts",
        file: rel,
        line: call.getStartLineNumber(),
        provider,
        api,
        signal,
        fields: parsed.fields,
        droppedFields: parsed.dropped,
        prompt,
        stateExprs,
        model: body ? (getProp(body, "model") ? modelRef(getProp(body, "model")!) : undefined) : extractModel(call),
        snippet: call.getText().split("\n").slice(0, 3).join("\n"),
      });
    }
  }
  return out;
}

// ---------- Python (via py/scan_py.py, stdlib ast) ----------

const PY_SCANNER = fileURLToPath(new URL("../py/scan_py.py", import.meta.url));

export function scanPython(dir: string): Candidate[] {
  const python = process.env.JEV_SWAP_PYTHON ?? "python3";
  const r = spawnSync(python, [PY_SCANNER, path.resolve(dir)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    console.warn(`Python scan skipped: could not run ${python} (${r.error.message}). Set JEV_SWAP_PYTHON to your interpreter.`);
    return [];
  }
  if (r.stderr.trim()) console.warn(r.stderr.trim());
  if (r.status !== 0) {
    console.warn(`Python scan failed (exit ${r.status}).`);
    return [];
  }
  return JSON.parse(r.stdout || "[]");
}

// ---------- model from committed .env examples ----------

const ENV_EXAMPLE_RE = /^(\.env\.(example|sample|template|dist)|example\.env|env\.example|\.env\.local\.example)$/;
const ENV_SKIP = new Set(["node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__"]);

function envExampleValues(root: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const walk = (d: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && !ENV_SKIP.has(e.name)) walk(p, depth + 1);
      else if (e.isFile() && ENV_EXAMPLE_RE.test(e.name)) {
        for (const line of fs.readFileSync(p, "utf8").split("\n")) {
          const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
          if (!m) continue;
          const v = m[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
          if (!v) continue;
          if (!out.has(m[1])) out.set(m[1], new Set());
          out.get(m[1])!.add(v);
        }
      }
    }
  };
  walk(root, 0);
  return out;
}

/** Fill in models that come from an env var, when every committed .env example agrees on its value. */
export function resolveEnvModels(root: string, candidates: Candidate[]): void {
  const pending = candidates.filter((c) => c.model && !c.model.id && c.model.envVar);
  if (!pending.length) return;
  const env = envExampleValues(path.resolve(root));
  for (const c of pending) {
    const vals = env.get(c.model!.envVar!);
    if (vals?.size === 1) c.model = { ...c.model!, id: [...vals][0], source: "env-example" };
  }
}

export function scan(dir: string): Candidate[] {
  const all = [...scanTs(dir), ...scanPython(dir)];
  resolveEnvModels(dir, all);
  // Keep ids unique across languages (e.g. triage.ts and triage.py).
  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c.id)) c.id = `${c.id}-${c.language}`;
    seen.add(c.id);
  }
  return all;
}
