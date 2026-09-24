#!/usr/bin/env python3
"""jev-swap Python scanner.

Usage: scan_py.py <dir>
Prints a JSON list of candidates (same shape as the TS scanner) for .py files under <dir>.
Stdlib only; needs Python 3.9+ (ast.unparse).
"""
from __future__ import annotations

import ast
import json
import os
import re
import sys

SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "env", "__pycache__", "site-packages",
             "dist", "build", ".tox", ".mypy_cache", ".pytest_cache"}
PROMPT_KEYS = {"content", "system", "prompt", "instructions", "input", "text"}
OPENAI_RE = re.compile(r"\.(chat\.completions\.(create|parse)|responses\.(create|parse))$")
ANTHROPIC_RE = re.compile(r"\.messages\.(create|parse)$")
# Both words must appear: "reply with ONLY the title, no quotes" is not a yes/no question.
YES_NO_RE = re.compile(r"\b(yes or no|yes/no|true or false)\b|\b(answer|respond|reply)\b[^.\n]{0,40}(\byes\b[^.\n]{0,60}\bno\b|\bno\b[^.\n]{0,60}\byes\b)", re.I)


def dotted(node: ast.AST) -> str:
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    elif isinstance(node, ast.Call):
        parts.append(dotted(node.func) + "()")
    else:
        parts.append("?")
    return ".".join(reversed(parts))


def last(node: ast.AST) -> str:
    return dotted(node).split(".")[-1]


def const_num(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        v = const_num(node.operand)
        return -v if v is not None else None
    return None


def const_str(node):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def is_none(node) -> bool:
    return isinstance(node, ast.Constant) and node.value is None


class Index:
    """Module-level definitions across all scanned files."""

    def __init__(self):
        self.models: dict[str, ast.ClassDef] = {}
        self.enums: dict[str, list[str]] = {}
        self.aliases: dict[str, ast.AST] = {}

    def add(self, tree: ast.Module):
        for stmt in tree.body:
            if isinstance(stmt, ast.ClassDef):
                bases = {last(b) for b in stmt.bases}
                if any("Enum" in b for b in bases):
                    vals = [const_str(s.value) for s in stmt.body
                            if isinstance(s, ast.Assign) and const_str(s.value) is not None]
                    if vals:
                        self.enums.setdefault(stmt.name, vals)
                elif any(isinstance(s, ast.AnnAssign) for s in stmt.body):
                    self.models.setdefault(stmt.name, stmt)
            elif isinstance(stmt, ast.Assign) and len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
                self.aliases.setdefault(stmt.targets[0].id, stmt.value)
            elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name) and stmt.value is not None:
                self.aliases.setdefault(stmt.target.id, stmt.value)
            elif hasattr(ast, "TypeAlias") and isinstance(stmt, getattr(ast, "TypeAlias")):
                self.aliases.setdefault(stmt.name.id, stmt.value)


class Ctx:
    def __init__(self, index: Index, file_aliases: dict, local_aliases: dict):
        self.index = index
        self.file_aliases = file_aliases
        self.local_aliases = local_aliases

    def resolve(self, name: str):
        for scope in (self.local_aliases, self.file_aliases, self.index.aliases):
            if name in scope:
                return scope[name]
        return None


# ---------- fields ----------

def score_field(name, lo, hi, desc):
    # Jev Score accepts 2..10 ordered levels.
    if not isinstance(lo, int) or not isinstance(hi, int):
        return None
    levels = hi - lo + 1
    if 2 <= levels <= 10:
        return {"name": name, "kind": "score", "min": lo, "max": hi, **({"description": desc} if desc else {})}
    return None


def bounds(call: ast.Call):
    kw = {k.arg: k.value for k in call.keywords if k.arg}
    desc = const_str(kw.get("description")) if kw.get("description") is not None else None
    lo = const_num(kw["ge"]) if "ge" in kw else (const_num(kw["gt"]) + 1 if "gt" in kw and const_num(kw["gt"]) is not None else None)
    hi = const_num(kw["le"]) if "le" in kw else (const_num(kw["lt"]) - 1 if "lt" in kw and const_num(kw["lt"]) is not None else None)
    return desc, lo, hi


def type_field(name, t, desc, lo, hi, ctx: Ctx, depth=0):
    if depth > 6 or t is None:
        return None
    rec = lambda n, d=desc, a=lo, b=hi: type_field(name, n, d, a, b, ctx, depth + 1)
    if isinstance(t, ast.BinOp) and isinstance(t.op, ast.BitOr):
        if is_none(t.right):
            return rec(t.left)
        if is_none(t.left):
            return rec(t.right)
        return None
    if isinstance(t, ast.Subscript):
        base = last(t.value)
        args = t.slice.elts if isinstance(t.slice, ast.Tuple) else [t.slice]
        if base == "Literal":
            opts = [const_str(a) for a in args]
            if opts and all(o is not None for o in opts):
                return {"name": name, "kind": "choice", "options": opts, **({"description": desc} if desc else {})}
            return None
        if base == "Optional":
            return rec(args[0])
        if base == "Annotated":
            for extra in args[1:]:
                if isinstance(extra, ast.Call) and last(extra.func) == "Field":
                    d, a, b = bounds(extra)
                    desc, lo, hi = desc or d, lo if lo is not None else a, hi if hi is not None else b
            return rec(args[0], desc, lo, hi)
        return None
    if isinstance(t, ast.Call) and last(t.func) == "conint":
        _, a, b = bounds(t)
        return score_field(name, a, b, desc)
    if isinstance(t, (ast.Name, ast.Attribute)):
        n = last(t)
        if n == "bool":
            return {"name": name, "kind": "noul", **({"description": desc} if desc else {})}
        if n == "int":
            return score_field(name, lo, hi, desc)
        if n in ctx.index.enums:
            return {"name": name, "kind": "choice", "options": ctx.index.enums[n], **({"description": desc} if desc else {})}
        alias = ctx.resolve(n)
        return rec(alias) if alias is not None else None
    if const_str(t) is not None:  # string annotation
        try:
            return rec(ast.parse(t.value, mode="eval").body)
        except SyntaxError:
            return None
    return None


def model_fields(cls: ast.ClassDef, ctx: Ctx):
    fields, dropped = [], []
    for s in cls.body:
        if not (isinstance(s, ast.AnnAssign) and isinstance(s.target, ast.Name)):
            continue
        if last(s.annotation.value if isinstance(s.annotation, ast.Subscript) else s.annotation) == "ClassVar":
            continue
        desc = lo = hi = None
        if isinstance(s.value, ast.Call) and last(s.value.func) == "Field":
            desc, lo, hi = bounds(s.value)
        f = type_field(s.target.id, s.annotation, desc, lo, hi, ctx)
        (fields.append(f) if f else dropped.append(s.target.id))
    return fields, dropped


def dict_get(d: ast.Dict, key: str):
    for k, v in zip(d.keys, d.values):
        if k is not None and const_str(k) == key:
            return v
    return None


def json_schema_fields(d: ast.Dict, ctx: Ctx):
    props = dict_get(d, "properties")
    if isinstance(props, ast.Name):
        props = ctx.resolve(props.id)
    if not isinstance(props, ast.Dict):
        return None
    fields, dropped = [], []
    for k, v in zip(props.keys, props.values):
        name = const_str(k) if k is not None else None
        if name is None:
            continue
        if not isinstance(v, ast.Dict):
            dropped.append(name)
            continue
        desc = const_str(dict_get(v, "description")) if dict_get(v, "description") is not None else None
        typ = const_str(dict_get(v, "type")) if dict_get(v, "type") is not None else None
        enum = dict_get(v, "enum")
        f = None
        if isinstance(enum, (ast.List, ast.Tuple)) and enum.elts and all(const_str(e) is not None for e in enum.elts):
            f = {"name": name, "kind": "choice", "options": [e.value for e in enum.elts], **({"description": desc} if desc else {})}
        elif typ == "boolean":
            f = {"name": name, "kind": "noul", **({"description": desc} if desc else {})}
        elif typ == "integer":
            f = score_field(name, const_num(dict_get(v, "minimum")), const_num(dict_get(v, "maximum")), desc)
        (fields.append(f) if f else dropped.append(name))
    return fields, dropped


def find_schema(node, ctx: Ctx, depth=0, seen=None):
    seen = seen if seen is not None else set()
    if node is None or depth > 10 or id(node) in seen:
        return None
    seen.add(id(node))
    if isinstance(node, (ast.Name, ast.Attribute)):
        n = last(node)
        if n in ctx.index.models:
            return model_fields(ctx.index.models[n], ctx)
        if isinstance(node, ast.Name):
            return find_schema(ctx.resolve(node.id), ctx, depth + 1, seen)
        return None
    children = []
    if isinstance(node, ast.Dict):
        r = json_schema_fields(node, ctx)
        if r and (r[0] or r[1]):
            return r
        children = list(node.values)
    elif isinstance(node, (ast.List, ast.Tuple)):
        children = list(node.elts)
    elif isinstance(node, ast.Call):
        children = list(node.args) + [k.value for k in node.keywords]
    for c in children:
        r = find_schema(c, ctx, depth + 1, seen)
        if r:
            return r
    return None


def choice_forces(tc) -> bool:
    """True when a tool_choice / function_call value forces a tool (so the tool schema is the output)."""
    if tc is None:
        return False
    lit = const_str(tc)
    if lit is not None:
        return lit in ("required", "any")
    if isinstance(tc, ast.Dict):
        t = dict_get(tc, "type")
        t = const_str(t) if t is not None else None
        return dict_get(tc, "name") is not None if t is None else t in ("tool", "any", "function")
    return True  # dynamic: assume forced


def tools_are_output(call: ast.Call, choice_key: str) -> bool:
    kw = {k.arg: k.value for k in call.keywords if k.arg}
    return choice_forces(kw.get(choice_key))


def schema_args(call: ast.Call):
    skip = set()
    names = {k.arg for k in call.keywords if k.arg}
    if "tools" in names and not tools_are_output(call, "tool_choice"):
        skip.add("tools")
    if "functions" in names and not tools_are_output(call, "function_call"):
        skip.add("functions")
    return list(call.args) + [k.value for k in call.keywords if k.arg not in skip]


# ---------- raw HTTP calls (requests / httpx / aiohttp ...) ----------

LLM_URL_RE = re.compile(r"api\.openai\.com|api\.anthropic\.com|openrouter\.ai/api|/v1/chat/completions|/chat/completions|/v1/responses|/v1/messages")


def url_text(node, ctx: Ctx, depth=0) -> str:
    if node is None or depth > 3:
        return ""
    s = const_str(node)
    if s is not None:
        return s
    if isinstance(node, ast.Name):
        v = ctx.resolve(node.id)
        return url_text(v, ctx, depth + 1) if v is not None else ""
    return ast.unparse(node)  # f-strings / concatenation keep their literal path parts


def http_request(call: ast.Call, ctx: Ctx):
    """(provider, api, body dict) for a POST whose URL is an LLM endpoint or whose JSON body is a chat request."""
    if not isinstance(call.func, ast.Attribute) or call.func.attr not in ("post", "request"):
        return None
    kw = {k.arg: k.value for k in call.keywords if k.arg}
    if call.func.attr == "request":
        method = const_str(call.args[0]) if call.args else const_str(kw.get("method")) if kw.get("method") is not None else None
        if not method or method.upper() != "POST":
            return None
        url_node = call.args[1] if len(call.args) > 1 else kw.get("url")
    else:
        url_node = call.args[0] if call.args else kw.get("url")
    body = kw.get("json")
    if body is None:
        d = kw.get("data", kw.get("content"))
        if isinstance(d, ast.Call) and last(d.func) == "dumps" and d.args:
            body = d.args[0]
    if isinstance(body, ast.Name):
        body = ctx.resolve(body.id)
    if not isinstance(body, ast.Dict):
        return None
    url = url_text(url_node, ctx)
    keys = {const_str(k) for k in body.keys if k is not None}
    llm_url = bool(LLM_URL_RE.search(url))
    if not (("model" in keys and "messages" in keys) or (llm_url and ("messages" in keys or "input" in keys))):
        return None
    provider = "anthropic" if re.search(r"anthropic|/v1/messages", url) else "openai"
    m = re.search(r"/v1/[a-z/]+|/chat/completions", url)
    return provider, "http " + (m.group(0) if m else "POST"), body


def schema_from_body(body: ast.Dict, ctx: Ctx):
    skip = set()
    if dict_get(body, "tools") is not None and not choice_forces(dict_get(body, "tool_choice")):
        skip.add("tools")
    if dict_get(body, "functions") is not None and not choice_forces(dict_get(body, "function_call")):
        skip.add("functions")
    for k, v in zip(body.keys, body.values):
        if k is None or const_str(k) in skip:
            continue
        r = find_schema(v, ctx)
        if r:
            return r
    return None


# ---------- prompt / state ----------

def extract_prompt(call: ast.Call, ctx: Ctx, extra_roots=()):
    texts, state = [], []
    values = [k.value for k in call.keywords if k.arg in PROMPT_KEYS]
    for arg in list(call.args) + [k.value for k in call.keywords] + list(extra_roots):
        for n in ast.walk(arg):
            if isinstance(n, ast.Dict):
                values += [v for k, v in zip(n.keys, n.values) if k is not None and const_str(k) in PROMPT_KEYS]
    seen = set()
    for v in values:
        if id(v) in seen:
            continue
        seen.add(id(v))
        s = const_str(v)
        if s is not None:
            texts.append(s)
        elif isinstance(v, ast.JoinedStr):
            t = ""
            for part in v.values:
                if const_str(part) is not None:
                    t += part.value
                elif isinstance(part, ast.FormattedValue):
                    expr = ast.unparse(part.value)
                    state.append(expr)
                    t += "{" + expr + "}"
            texts.append(t)
        elif isinstance(v, ast.Name) and const_str(ctx.resolve(v.id)) is not None:
            texts.append(ctx.resolve(v.id).value)
        elif not isinstance(v, (ast.List, ast.Dict, ast.Tuple)):
            state.append(ast.unparse(v))
    return ("\n\n".join(texts) if texts else None), list(dict.fromkeys(state))


# ---------- model ----------

def env_var(node):
    """(name, default) for os.getenv("X", d) / os.environ.get("X", d) / os.environ["X"]."""
    if isinstance(node, ast.Call) and dotted(node.func) in ("os.getenv", "getenv", "os.environ.get", "environ.get"):
        name = const_str(node.args[0]) if node.args else None
        default = node.args[1] if len(node.args) > 1 else next((k.value for k in node.keywords if k.arg == "default"), None)
        return name, default
    if isinstance(node, ast.Subscript) and dotted(node.value) in ("os.environ", "environ"):
        return const_str(node.slice), None
    return None


def model_ref(node, ctx: Ctx, depth=0):
    expr = ast.unparse(node)
    if depth > 4:
        return {"source": "unknown", "expr": expr}
    s = const_str(node)
    if s is not None:
        return {"id": s, "source": "literal"}
    if isinstance(node, ast.Name):
        v = ctx.resolve(node.id)
        return model_ref(v, ctx, depth + 1) if v is not None else {"source": "unknown", "expr": expr}
    ev = env_var(node)
    if ev:
        name, default = ev
        d = const_str(default) if default is not None else None
        ref = {"id": d, "source": "default"} if d is not None else {"source": "unknown"}
        return {**ref, **({"envVar": name} if name else {}), "expr": expr}
    if isinstance(node, ast.BoolOp) and isinstance(node.op, ast.Or) and len(node.values) == 2:
        d = const_str(node.values[1])
        ev = env_var(node.values[0])
        if d is not None:
            return {"id": d, "source": "default", **({"envVar": ev[0]} if ev and ev[0] else {}), "expr": expr}
    return {"source": "unknown", "expr": expr}


def extract_model(call: ast.Call, provider: str, ctx: Ctx):
    target = call
    if provider == "langchain":
        # llm.with_structured_output(...): the model is on the chat model constructor, e.g. ChatOpenAI(model=...)
        recv = call.func.value
        if isinstance(recv, ast.Name):
            recv = ctx.resolve(recv.id)
        if not isinstance(recv, ast.Call):
            return None
        target = recv
    for k in target.keywords:
        if k.arg in ("model", "model_name"):
            return model_ref(k.value, ctx)
    return None


# ---------- main ----------

def local_assigns(fn) -> dict:
    out = {}
    if fn is None:
        return out
    for n in ast.walk(fn):
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
            out.setdefault(n.targets[0].id, n.value)
    return out


def iter_calls(tree):
    """Yield (call, enclosing function or None)."""
    stack = [(tree, None)]
    while stack:
        node, fn = stack.pop()
        for child in ast.iter_child_nodes(node):
            cfn = child if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) else fn
            if isinstance(child, ast.Call):
                yield child, fn
            stack.append((child, cfn))


def scan(root: str):
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        files += [os.path.join(dirpath, f) for f in filenames if f.endswith(".py")]

    index, parsed = Index(), []
    for path in sorted(files):
        try:
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
            tree = ast.parse(src)
        except (SyntaxError, UnicodeDecodeError) as e:
            print(f"jev-swap: skipping {path}: {e}", file=sys.stderr)
            continue
        index.add(tree)
        parsed.append((path, src, tree))

    out, ids = [], {}
    for path, src, tree in parsed:
        file_idx = Index()
        file_idx.add(tree)
        lines = src.splitlines()
        for call, fn in iter_calls(tree):
            name = dotted(call.func)
            provider = api = body = None
            if OPENAI_RE.search(name):
                provider = "openai"
            elif ANTHROPIC_RE.search(name) and "threads" not in name:
                provider = "anthropic"
            elif isinstance(call.func, ast.Attribute) and call.func.attr == "with_structured_output":
                provider = "langchain"
            ctx = None
            if not provider and isinstance(call.func, ast.Attribute) and call.func.attr in ("post", "request"):
                ctx = Ctx(index, file_idx.aliases, local_assigns(fn))
                http = http_request(call, ctx)
                if http:
                    provider, api, body = http
            if not provider:
                continue
            api = api or ".".join(name.split(".")[-3:])
            ctx = ctx or Ctx(index, file_idx.aliases, local_assigns(fn))
            prompt, state = extract_prompt(call, ctx, [body] if body is not None else [])
            parsed_schema, signal = None, "schema"
            if body is not None:
                parsed_schema = schema_from_body(body, ctx)
            else:
                for a in schema_args(call):
                    parsed_schema = find_schema(a, ctx)
                    if parsed_schema:
                        break
            if (not parsed_schema or not parsed_schema[0]) and prompt and YES_NO_RE.search(prompt):
                parsed_schema, signal = ([{"name": "answer", "kind": "noul"}], []), "prompt-heuristic"
            if not parsed_schema or not parsed_schema[0]:
                continue
            if body is not None:
                m = dict_get(body, "model")
                model = model_ref(m, ctx) if m is not None else None
            else:
                model = extract_model(call, provider, ctx)
            rel = os.path.relpath(path, root)
            base = re.sub(r"[^\w.-]", "_", f"{os.path.splitext(os.path.basename(rel))[0]}-{fn.name if fn else 'L' + str(call.lineno)}")
            ids[base] = ids.get(base, 0) + 1
            out.append({
                "id": base if ids[base] == 1 else f"{base}-{ids[base]}",
                "language": "python",
                "file": rel,
                "line": call.lineno,
                "provider": provider,
                "api": api,
                "signal": signal,
                "fields": parsed_schema[0],
                "droppedFields": parsed_schema[1],
                **({"prompt": prompt} if prompt else {}),
                "stateExprs": state,
                **({"model": model} if model else {}),
                "snippet": "\n".join(lines[call.lineno - 1: call.lineno + 2]),
            })
    out.sort(key=lambda c: (c["file"], c["line"]))
    return out


if __name__ == "__main__":
    json.dump(scan(sys.argv[1] if len(sys.argv) > 1 else "."), sys.stdout)
