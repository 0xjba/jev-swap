# jev-swap

Find LLM calls in a TypeScript/JavaScript or Python codebase that are really decisions, convert them to [TypeSafe Jev](https://docs.typesafe.ai), and shadow-test them on recorded traffic.

```sh
npx jev-swap scan ./your-app        # no install needed
npm install -g jev-swap             # or install the `jev-swap` command
```

Requires Node >= 22.12. Python scanning also needs Python >= 3.9 on PATH as `python3` (override with `JEV_SWAP_PYTHON`); it uses only the standard library.

Generated code targets `@typesafe-ai/sdk` 0.6.0 (TS) and `typesafe-sdk` 0.7.1 (Python: `pip install typesafe-sdk`; note `typesafe-ai` on PyPI is an unofficial shim).

## Commands

```sh
# 1. Scan: finds decision-type LLM calls (enum, boolean, small integer range, or yes/no prompts)
#    TS/JS:  OpenAI chat.completions / responses, Anthropic messages, AI SDK (zod or JSON schema)
#    Python: OpenAI chat.completions / responses, Anthropic messages, LangChain
#            with_structured_output (Pydantic models, Enum, Literal, Annotated/Field/conint, JSON schema dicts)
#    Both:   raw HTTP POSTs (fetch/axios/ky/got, requests/httpx/aiohttp) to OpenAI, Anthropic or OpenRouter
#            endpoints, or any POST whose JSON body has model + messages
npx jev-swap scan ./path/to/app            # -> jev-swap-out/candidates.json

# 2. Convert: one Jev module per candidate (.ts or .py) with decide() and a confidence-gated fallback
npx jev-swap convert                        # -> jev-swap-out/jev/*.ts, samples.template.jsonl

# 3. Shadow: replay recorded inputs + LLM outputs through Jev, write REPORT.md
npx jev-swap shadow samples.jsonl --llm-price-in 1.25 --llm-price-out 10 --monthly-calls 1000000
```

Try it without an API key: `npx jev-swap shadow samples.jsonl --mock` runs the pipeline against a simulated Jev (clearly labelled in the report).

## Live shadow proxy

```sh
npx jev-swap proxy --llm-price-in 1 --llm-price-out 5     # needs TYPESAFE_API_KEY, or --mock

# then point your app at it (API keys pass through untouched):
OPENAI_BASE_URL=http://localhost:8787/openai/v1
ANTHROPIC_BASE_URL=http://localhost:8787/anthropic
```

Every request is forwarded to the real API unchanged. Requests that match a scanned candidate (by output schema, enum values, or yes/no prompt text) are also sent to Jev in parallel, and the dashboard at `http://localhost:8787/` shows agreement, LLM vs Jev latency, savings so far, the confidence curve, and a disagreement inbox. Once a candidate has `--min-samples` mirrored calls (default 50) and a threshold meets `--target`, "Apply threshold" writes it into the generated module.

Mirrored calls are appended to `jev-swap-out/proxy-samples.jsonl` in the `shadow` samples format, so they can be replayed later. That file contains your users' inputs: keep it out of version control.

Limits: streaming requests are forwarded but not mirrored; Jev's state is the last user message; two candidates with identical schemas or prompts both match the first one scanned.

Keyless demo with a fake LLM and simulated Jev, from a clone of this repo: `npm run demo:proxy`, then open `http://localhost:8787/`.

## Public OSS savings data (phase 1)

Finds public repos with LLM decision calls and estimates the **percentage** cost reduction of moving each call to Jev. No dollar figures: repos don't publish traffic, and volume cancels out of a percentage.

```sh
npx jev-swap oss discover               # well-known repos: AI topics x Python/TS/JS, >= 1000 stars, pushed in the last year -> oss-out/queue.json
npx jev-swap oss discover --code         # or: code search for SDK patterns (needs GITHUB_TOKEN; stars checked at scan)
npx jev-swap oss discover --popular      # or: most-starred Python/TS/JS repos of any topic (company products), in star bands
npx jev-swap oss add owner/repo          # queue a repo by hand (no token needed)
npx jev-swap oss scan --limit 50         # most-starred first; skips repos with no LLM SDK in production manifests; shallow clone, scan, count tokens, delete clone -> oss-out/scans/*.json
npx jev-swap oss build                   # price candidates -> oss-out/dashboard.json
```

- Per call: `llm_cost = (prompt + state) * llm_in + output * llm_out`, `jev_cost = (jev_base + jev_per_question * questions + state_factor * state) * jev_in`, with Jev's request overhead fitted from live calls (`data/jev-measure.json`), `reduction = 1 - jev_cost / llm_cost`. User input size (`state`) is unknown, so each figure is a range over `--state-min`..`--state-max` tokens (default 50..2000).
- LLM-side costs leave out reasoning tokens, schema and tool definitions, and framing, so they're a lower bound and the reduction is conservative. Every figure is labelled `estimated` in this phase.
- The model comes from the call's literal, a literal fallback next to an env var, or a committed `.env.example`. Unknown or unpriced models are listed but left out of totals, as are calls that also return free-text fields Jev can't produce (`partial-swap`).
- Production code only: calls in tests, examples/demos/samples/docs/cookbooks/templates, evals/benchmarks/scripts/experiments, and repos that are sample collections (`*-examples`, `awesome-*`, ...) are excluded and counted separately. Repos whose scan errored are retried on the next `oss scan`.
- Prices live in `data/prices.json`, each with its source URL and check date. Token counts use tiktoken for OpenAI models it knows, Anthropic `count_tokens` when `ANTHROPIC_API_KEY` is set, and otherwise a labelled chars/4 estimate.
- Stored per repo: name, commit SHA, license, stars, and per call file:line, schema shape (field names, kinds, options), model, and token counts. Prompt text and code are never stored. Forks and archived repos are skipped; repos without a detected license are scanned (only links and schema shapes are stored) unless you pass `--require-license`.
- Prices: `oss prices` refreshes `oss-out/prices.json` (falling back to the snapshot bundled in `data/prices.json`) from OpenRouter's models API (every provider's list price) and Jev's OpenRouter page; models not listed there stay unpriced.
- Speed: `oss prices` also records each used model's p50 latency and throughput from its OpenRouter page. A call's LLM time is estimated as latency + output tokens / throughput and compared with Jev's measured p50 latency from `data/jev-measure.json` (re-measure with `oss measure-jev`, needs `TYPESAFE_API_KEY`). Where Jev isn't cheaper but is within 15% of the cost and at least 1.5x faster, the call reads "about the same cost, N x faster".
- Calls whose model is chosen at runtime are compared with likely models: ones the same repo uses elsewhere, else the provider's small default models in `data/reference-models.json` (gpt-4o-mini, gpt-5-mini, Claude Haiku 4.5, Gemini 2.5 Flash) for the provider its SDK targets. Only models where Jev saves cost or time are shown, and these figures stay out of the headline.
- Two tiers: repos at or above `oss build --featured-min-stars` (default 1000) are featured individually; every scanned repo counts toward the aggregate metrics. Sample less-known repos with `oss scan --min-stars 0 --max-stars 1000`.
- Only well-known projects: `--min-stars` (default 1000) applies on discover and scan; `--orgs-only` limits to organization-owned repos. Discovery works without a token (10 requests/min), faster with `GITHUB_TOKEN`.
- Raw HTTP calls count too: `fetch`/axios/ky/got and `requests`/`httpx`/`aiohttp` POSTs to OpenAI, Anthropic or OpenRouter endpoints, or any POST whose JSON body has `model` and `messages`. The pre-clone check only reads dependency manifests, so repos calling the API without an SDK are skipped there; `oss scan --recheck-no-sdk --limit 200` re-clones those to measure what that misses, and `oss build` reports how many listed calls came from raw HTTP.
- Opt-out: add `owner/repo` or `owner/*` to `data/optout.txt`.

## Website

`site/` is a static site with no build step to serve it; deploy the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel):

- `index.html`: jev-swap itself: finding decision calls, their cost and speed on Jev, converting, and proving it.
- `explorer.html`: the Explorer (what public repos could save), generated from `oss-out/dashboard.json` (raw data copied to `site/data/explorer.json`).
- `proxy.html`: the shadow proxy.

The pages are generated: edit `site/gen/` (`build.py` for copy, `layout.py` for styles and navigation, `scenes.py` for the illustrations) and run `npm run site` after `oss prices` / `oss build`. Figures come from `data/prices.json` and the dashboard data, not hard-coded values. Preview on your network with `python3 -m http.server 8000 --bind 0.0.0.0 --directory site`, then open `http://<your machine's IP>:8000`.

## Explainer video

`video/` is a Remotion project for the 70 s "What is jev-swap?" video (1920x1080, 30 fps, no audio). Its cost and speed figures are the site's sourced Claude Sonnet 5 example.

```sh
cd video && npm install
npm run studio     # preview and edit
npm run render     # -> video/out/what-is-jev-swap.mp4
```

## Samples format (JSONL)

```json
{"candidate":"triage-classifyTicket","state":"raw input the LLM saw","llm":{"category":"billing","urgent":true,"priority":3},"llm_usage":{"input_tokens":180,"output_tokens":60}}
```

`llm_usage` is optional; it's needed only for LLM cost comparison.

## Mapping

| LLM output type | Jev question |
|---|---|
| `z.enum`, union of `z.literal`, `Literal[...]`, `Enum` class, JSON schema `enum`, `Output.choice` | Choice |
| `z.boolean`, `bool`, JSON schema `boolean`, "answer yes or no" prompt | Noul (yes if >= 0.5) |
| integer with min/max (zod, `Field(ge, le)`, `conint`, JSON schema), 2–10 values | Score (levels = each integer) |
| anything else (free text, nested objects) | dropped, flagged in the generated file |

## Notes

- Python name resolution covers module-level definitions across the scanned files and assignments inside the enclosing function. Imports from installed packages aren't followed.
- Decision confidence = the lowest across fields. Noul has no `confidence` field in the API, so it's derived as `|p - 0.5| * 2`.
- Recommended threshold = lowest threshold where agreement on covered calls >= `--target` (default 0.95). On real runs it's written into each module's `THRESHOLD`.
- `--mock` simulates Jev by agreeing with the recorded LLM label at `--mock-agreement`. Mock numbers are not Jev accuracy; the report says so.
- Default Jev price: $0.042 per 1M input tokens, output free (override with `--jev-price-in`).
- Review generated instructions: Jev works best with one short question per field.
- `convert` warns when a score field has no description: the generated question then guesses which end of the scale is highest. Say what the ends mean (e.g. "1 = low, 5 = critical") to match your LLM prompt.

## Development

```sh
git clone https://github.com/0xjba/jev-swap && cd jev-swap
npm install && npm run build
node dist/cli.js --help      # or: npm run dev -- --help
npm run demo                 # scan + convert + a --mock shadow run on examples/demo-app
```

## License

MIT. See [LICENSE](LICENSE).
