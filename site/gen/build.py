"""Builds the jev-swap site: python3 site/gen/build.py  (or: npm run site)

  site/index.html      jev-swap: find the LLM calls that are decisions, what they'd cost and how fast they'd run on Jev
  site/proxy.html      the shadow proxy (second product)
  site/explorer.html   the open-source explorer, from oss-out/dashboard.json (run `oss build` first)
  site/data/explorer.json   its data, for download

Every figure is sourced (footer / methodology) or computed here from data/prices.json (OpenRouter).
"""
import html
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
import scenes  # noqa: E402  (generates the SVGs and registers their keyframes)
from layout import CALC_JS, LOGO, code, fact, footer, page, qa, step, wrap  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
ROOT = os.path.dirname(SITE)

scan_svg, _ = scenes.hero_scan()
scan_m_svg, _ = scenes.hero_scan_mobile()
proxy_svg, _ = scenes.hero()
proxy_m_svg, _ = scenes.hero_mobile()
gate_svg, _ = scenes.gate()
i_scan, i_conv, i_shadow = scenes.icon_scan(), scenes.icon_convert(), scenes.icon_shadow()

# Prices refreshed by `oss prices` (oss-out/prices.json), else the snapshot bundled with the package.
_local_prices = os.path.join(ROOT, "oss-out", "prices.json")
prices = json.load(open(_local_prices if os.path.exists(_local_prices) else os.path.join(ROOT, "data", "prices.json")))
JEV = prices["jev"]
# Jev's measured request profile (`jev-swap oss measure-jev`): billed tokens and latency.
_local_prof = os.path.join(ROOT, "oss-out", "jev-measure.json")
PROF = json.load(open(_local_prof if os.path.exists(_local_prof) else os.path.join(ROOT, "data", "jev-measure.json")))["profile"]
FETCHED = prices["fetchedAt"][:10]
dash_path = os.path.join(ROOT, "oss-out", "dashboard.json")
DASH = json.load(open(dash_path)) if os.path.exists(dash_path) else None


def models_in_use():
    """Priced models named in public decision calls, most calls first (ties: more repos)."""
    calls, repos = {}, {}
    for r in (DASH or {}).get("repos", []):
        for c in r["candidates"]:
            if c["price"]:
                k = c["price"]["key"]
                calls[k] = calls.get(k, 0) + 1
                repos.setdefault(k, set()).add(r["repo"])
    return sorted(calls, key=lambda k: (-calls[k], -len(repos[k]))), calls, repos


USED, USED_CALLS, USED_REPOS = models_in_use()
# The headline comparison model (needs OpenRouter price and speed data).
CMP_KEY = "anthropic/claude-sonnet-5"
CMP = prices["models"][CMP_KEY]
CMP_NAME = "Claude Sonnet 5"
MOST_USED = USED[0] if USED else None

# A 400-input / 20-output-token, one-question decision call, at OpenRouter list prices.
TIN, TOUT, QS = 400, 20, 1
JEV_TIN = round(PROF["baseTokens"] + PROF["perQuestion"] * QS + PROF["stateFactor"] * TIN)
LLM_CALL = (TIN * CMP["in"] + TOUT * CMP["out"]) / 1e6
JEV_CALL = JEV_TIN * JEV["in"] / 1e6
REDUCTION = (1 - JEV_CALL / LLM_CALL) * 100
MULTIPLE = LLM_CALL / JEV_CALL
JEV_MS = PROF["p50Ms"]
MEASURED = f'its p50 over {PROF["calls"]} live calls we timed on {PROF["measuredAt"][:10]}'
SPEED = CMP.get("speed")
LLM_MS = SPEED["p50LatencyMs"] + TOUT / SPEED["p50ThroughputTps"] * 1000 if SPEED else None

SOURCES = f'''<li>Jev pricing: <a href="{JEV["source"]}">OpenRouter model page for Jev 1.13</a>, matching TypeSafe&#39;s published rate. Checked {JEV["checked"]}.</li>
<li>Independent routing test, 1,000 eight-way decisions: <a href="https://www.ayautomate.com/blog/jev-pricing-cost-per-decision">AY Automate</a>. One workload; yours will differ.</li>
<li>TypeSafe docs, <a href="https://docs.typesafe.ai/cookbooks/parallel_questions">Parallel questions cookbook</a>.</li>
<li>Latency as reported by TypeSafe, via <a href="https://www.firecrawl.dev/blog/what-is-jev">Firecrawl&#39;s overview of Jev</a>.</li>
<li>Model prices and latency: <a href="https://openrouter.ai/models">OpenRouter</a> list prices and each model&#39;s p50 latency and throughput on its busiest provider, fetched {FETCHED}.</li>'''

e = html.escape


def pct(x):
    return f"{x * 100:.0f}%"


def rng(r):
    lo, hi = round(r["low"] * 100), round(r["high"] * 100)
    return f"{lo}%" if lo == hi else f"{lo}–{hi}%"


def stars(n):
    return f"{n / 1000:.1f}k" if n >= 1000 else str(n)


VENDORS = {"openai": "OpenAI", "anthropic": "Anthropic", "google": "Google", "x-ai": "xAI", "deepseek": "DeepSeek",
           "meta-llama": "Meta Llama", "mistralai": "Mistral", "qwen": "Qwen"}
# Each provider's small and flagship models, alongside whatever public decision calls use.
CALC_MODELS = ["openai/gpt-4o-mini", "openai/gpt-4.1-mini", "openai/gpt-5-mini", "openai/gpt-4o", "openai/gpt-4.1", "openai/gpt-5",
               "anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4.5", "anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-5",
               "google/gemini-2.5-flash-lite", "google/gemini-2.5-flash", "google/gemini-2.5-pro",
               "deepseek/deepseek-v4-flash", "deepseek/deepseek-chat", "x-ai/grok-4.7", "mistralai/mistral-medium-3-5",
               "meta-llama/llama-4-scout"]


def money_per_m(x):
    return f"{x:.3g}" if x < 1 else f"{x:g}"


def model_options():
    keys = [k for k in dict.fromkeys(USED + CALC_MODELS) if k in prices["models"]]
    groups = {}
    for k in keys:
        groups.setdefault(k.split("/")[0], []).append(k)
    order = [v for v in VENDORS if v in groups] + sorted(v for v in groups if v not in VENDORS)
    out = []
    for v in order:
        opts = []
        for k in sorted(groups[v], key=lambda k: prices["models"][k]["in"]):
            m = prices["models"][k]
            tag = " · most used in public decision calls" if k == MOST_USED else ""
            sel = " selected" if k == CMP_KEY else ""
            opts.append(f'<option value="{e(k)}" data-in="{m["in"]:g}" data-out="{m["out"]:g}"{sel}>{e(k.split("/", 1)[1])} · ${money_per_m(m["in"])} / ${money_per_m(m["out"])}{tag}</option>')
        out.append(f'<optgroup label="{e(VENDORS.get(v, v))}">{"".join(opts)}</optgroup>')
    out.append('<option value="custom">Other (enter prices below)</option>')
    return "".join(out)


# ======================================================================
# HOME
# ======================================================================
def home():
    T = typical()
    proof = (f'<div class="proof"><span class="pchip"><strong>{pct(T["save"])}</strong> cheaper</span><span class="pchip"><strong>{T["speed"]:.1f}×</strong> faster</span>'
             f'<span class="small">typical for decision calls in public code. <a href="explorer.html">See the data</a></span></div>' if T else "")
    explore_label = "See what open source could save"
    hero = wrap(f'''<div class="row hero-head">
<div class="hero-copy"><p class="eyebrow">// open source · for teams running llm calls in production</p>
<h1 class="h1">Stop paying LLM prices for <span class="pink">yes/no answers.</span></h1></div>
<div class="hero-side"><p class="body">jev-swap finds the LLM calls in your code that only ever return a label, a yes/no or a 1–5 score, rewrites them for TypeSafe Jev with your current call as the fallback, and proves the swap on your own traffic.</p>
<div class="row" style="gap: 12px;"><a class="btn btn-fill" href="#install"><span class="kbd" aria-hidden="true">&gt;</span>Scan my codebase</a><a class="btn btn-line" href="explorer.html">{explore_label}</a></div>
<p class="small">No API key needed to scan · TypeScript, JavaScript, Python</p>
{proof}</div>
</div>
<div class="hero-art"><div class="d">{scan_svg}</div><div class="m">{scan_m_svg}</div></div>
''', id_="top")

    def fact_link(big, text, href, cls=""):
        return (f'<div class="fact"><div class="fact-big {cls}">{big}</div>'
                f'<div class="fact-txt">{text} <a href="{href}" class="src">source</a></div></div>')
    facts = wrap(f'''<div class="facts">
{fact_link(str(T["calls"]) if T else "–", "decision calls found in public repos so far", "explorer.html")}
{fact_link(pct(T["save"]) if T else "–", "median cost cut per call, counting the ones with no saving", "explorer.html#method", "pink")}
{fact_link(f"{T['speed']:.1f}×" if T else "–", "median speedup: each model&#39;s OpenRouter latency vs Jev at {JEV_MS} ms, " + MEASURED, "explorer.html#method", "pink")}
{fact_link("$" + format(JEV["in"], "g"), "per 1M input tokens on Jev. Output tokens are free.", JEV["source"])}
</div>''', label="jev-swap by the numbers")

    problem = wrap('''<div class="sec"><div class="row" style="gap: 32px 56px;">
<h2 class="h2" style="flex: 1 1 380px;">Your LLM is making decisions. You&#39;re paying it to <span class="pink">write essays.</span></h2>
<div style="flex: 1 1 480px; display: flex; flex-direction: column; gap: 20px;">
<p class="body">Ticket routing, spam checks, moderation verdicts, refund triage, priority scores: each one runs a text-generation model to return one word from a list you already wrote.</p>
<p class="body">Jev is built for that job. Send the input and typed questions; get back a typed answer with probabilities and a confidence score, with no text generated and no output tokens billed.</p>
<p class="body" style="color: #ECEDEF; font-weight: 500;">The hard part is finding which calls qualify and trusting the swap. That&#39;s what jev-swap does.</p>
</div></div></div>''')

    # Speed + cost, from OpenRouter data for Claude Haiku 4.5 and Jev's reported latency.
    if LLM_MS:
        llm_end = 70.0
        jev_end = 5 + (llm_end - 5) * JEV_MS / LLM_MS
        race_css = (f"@keyframes rl{{0%,5%{{left:0}}{llm_end:.1f}%,100%{{left:calc(100% - 12px)}}}}"
                    f"@keyframes rj{{0%,5%{{left:0}}{jev_end:.1f}%,100%{{left:calc(100% - 12px)}}}}"
                    f"@keyframes fl{{0%,{llm_end - 1:.1f}%{{opacity:.25}}{llm_end + 1:.1f}%,94%{{opacity:1}}98%,100%{{opacity:.25}}}}"
                    f"@keyframes fj{{0%,{jev_end - 1:.1f}%{{opacity:.25}}{jev_end + 1:.1f}%,94%{{opacity:1}}98%,100%{{opacity:.25}}}}")
        llm_note = f"~{LLM_MS / 1000:.1f} s for this call: OpenRouter p50 latency + output time, busiest provider, fetched {FETCHED}"
        speedup = f"{LLM_MS / JEV_MS:.1f}× faster"
    else:
        race_css, llm_note, speedup = "", "latency: measured in your shadow run", "faster"
    speed = wrap(f'''<div class="sec">
<div class="row" style="justify-content: space-between; align-items: flex-end; gap: 24px 64px;">
<div style="flex: 1 1 480px; display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// cost and speed</p>
<h2 class="h2">The same decision at a fraction of the cost, and faster.</h2></div>
<p class="body" style="flex: 1 1 360px; max-width: 480px;">On {e(CMP_NAME)}, a typical {TIN}-token decision call costs ${LLM_CALL:.5f} and takes about {LLM_MS / 1000:.1f} s. On Jev it costs ${JEV_CALL:.6f} and answered in {JEV_MS} ms at the median of our live test calls.</p>
</div>
<div class="panel race" role="img" aria-label="The same decision call on {e(CMP_NAME)} and on Jev. Jev answers first.">
<div class="lane"><span class="lane-name">{e(CMP_NAME)}</span><div class="track"><span class="runner runner-llm"></span></div><span class="flag flag-llm">answered</span>
<p class="lane-note">{e(llm_note)}</p></div>
<div class="lane"><span class="lane-name pink">jev</span><div class="track"><span class="runner runner-jev"></span></div><span class="flag flag-jev">answered</span>
<p class="lane-note">{JEV_MS} ms: {e(MEASURED)} (TypeSafe reports 70–500 ms)</p></div>
<p class="small">Lane lengths are to scale for these two figures. Your model and inputs will differ: the shadow run measures them.</p>
</div>
<div style="display: flex; flex-direction: column; gap: 16px;">
<div class="costs">
<div class="cost"><span class="small mono">{e(CMP_NAME)} · per call</span><span class="cost-big">${LLM_CALL:.6f}</span><span class="body" style="font-size: 15px;">${LLM_CALL * 1e6:,.2f} per million calls</span></div>
<div class="cost"><span class="small mono pink">jev · per call</span><span class="cost-big pink">${JEV_CALL:.7f}</span><span class="body" style="font-size: 15px;">${JEV_CALL * 1e6:,.2f} per million calls</span></div>
<div class="cost cost-hi"><span class="small mono" style="color: #FCD9E3;">difference</span><span class="cost-big" style="color: #FFFFFF;">{REDUCTION:.1f}% lower</span><span class="body" style="font-size: 15px; color: #FCD9E3;">{MULTIPLE:.1f}× cheaper · {speedup}</span></div>
</div>
<p class="small">A {TIN}-input, {TOUT}-output-token call at OpenRouter list prices fetched {FETCHED}: {e(CMP_NAME)} at ${CMP["in"]:g} in / ${CMP["out"]:g} out per 1M tokens, Jev at ${JEV["in"]:g} in, output free. Jev bills its own framing: {JEV_TIN} input tokens for this call, from {PROF["baseTokens"]} + {PROF["perQuestion"]} per question + {PROF["stateFactor"]:g} × input, measured on live calls.</p>
<p class="small">Independent check: a test of 1,000 eight-way routing decisions found Jev about 40× cheaper than GPT-5.6 Terra ($0.0151 vs $0.6089). <a href="https://www.ayautomate.com/blog/jev-pricing-cost-per-decision">AY Automate</a></p>
</div>
</div>''', id_="speed")

    how = wrap(f'''<div class="sec">
<div style="display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// how it works</p><h2 class="h2">Three commands from LLM call to Jev call.</h2></div>
<div class="g3">
{step("01", "scan", "Find the decisions", "Reads your code&#39;s syntax tree and flags LLM calls whose output is an enum, a boolean, or a small integer range, whether it&#39;s a zod schema, a Pydantic model, JSON schema, or a raw HTTP call to the API. Also catches plain &quot;answer yes or no&quot; prompts.", i_scan, "npx jev-swap scan ./app")}
{step("02", "convert", "Generate the Jev version", "Writes one module per call, in the same language, on TypeSafe&#39;s official SDK: one short question per field, all in a single request. Free-text fields Jev can&#39;t produce are flagged, never silently dropped.", i_conv, "npx jev-swap convert")}
{step("03", "shadow", "Prove it on your traffic", "Replays inputs your LLM already answered through Jev and measures agreement, Jev&#39;s latency and cost per call. It picks the confidence threshold that hits your accuracy target and writes it into the code.", i_shadow, "npx jev-swap shadow logs.jsonl")}
</div></div>''', id_="how")

    safety = wrap(f'''<div class="sec"><div class="row" style="align-items: center; gap: 40px 56px;">
<div style="flex: 1 1 400px; display: flex; flex-direction: column; gap: 22px; min-width: 0;">
<p class="eyebrow">// the safety net</p>
<h2 class="h2">Jev when it&#39;s sure. Your LLM when it isn&#39;t.</h2>
<p class="body">Every Jev answer carries a confidence score. The generated code acts on Jev above your threshold and calls the model you use today below it, so the cases Jev isn&#39;t sure about keep the accuracy you have now. Your existing call stays in the code.</p>
<pre class="panel" style="padding: 20px 22px; font-size: 13px;"><span class="c-com">// generated: jev-swap-out/jev/triage-classifyTicket.ts</span>
<span class="c-kw">export const</span> THRESHOLD = 0.7; <span class="c-com">// set by shadow run</span>

<span class="c-kw">const</span> ticket = <span class="c-kw">await</span> decideWithFallback(
  text,
  () =&gt; classifyWithLLM(text), <span class="c-com">// your existing call</span>
);
ticket.source <span class="c-com">// &quot;jev&quot; or &quot;llm&quot;</span></pre>
</div>
<div style="flex: 1 1 420px; min-width: 0; max-width: 560px; margin: 0 auto;">{gate_svg}</div>
</div></div>''')

    teaser = ""
    if DASH:
        t = DASH["totals"]
        teaser = wrap(f'''<div class="sec">
<div class="row" style="justify-content: space-between; align-items: flex-end; gap: 24px 64px;">
<div style="flex: 1 1 480px; display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// in the wild</p>
<h2 class="h2">What we found in public code.</h2></div>
<a class="btn btn-line" href="explorer.html">See what open source could save</a>
</div>
<div class="stat-row">
<div class="stat"><span class="stat-big">{t["reposScanned"]:,}</span><span class="small">public repos scanned</span></div>
<div class="stat"><span class="stat-big">{t["reposWithCandidates"]}</span><span class="small">make decisions with an LLM, including widely used projects like firecrawl and LightRAG</span></div>
<div class="stat"><span class="stat-big pink">{pct(T["save"])}</span><span class="small">median cost cut per decision call</span></div>
<div class="stat"><span class="stat-big pink">{T["speed"]:.1f}×</span><span class="small">median speedup on Jev</span></div>
</div>
<p class="small">Estimates at OpenRouter list prices and latency, data as of {T["date"]}. Every call links to its file and line; <a href="explorer.html#method">here&#39;s the method</a>.</p>
</div>''')

    trailer = wrap(f'''<div class="sec"><div class="trailer">
<div style="display: flex; flex-direction: column; gap: 20px;">
<p class="eyebrow">// also from jev-swap: the shadow proxy</p>
<h2 class="h2">Or watch it happen on live traffic.</h2>
<p class="body">Point your OpenAI or Anthropic client at the shadow proxy. Every request still reaches your model untouched, while decision calls are mirrored to Jev in parallel and a live dashboard compares answers, latency and cost.</p>
<a class="btn btn-line" href="proxy.html" style="align-self: flex-start;">Meet the shadow proxy</a>
</div>
<div style="min-width: 0;">{proxy_m_svg}</div>
</div></div>''')

    def inp(id_, label, value, extra=""):
        return f'<div class="field"><label class="lbl" for="{id_}">{label}</label><input class="in" id="{id_}" type="number" min="0" {extra} value="{value}"></div>'

    calc = wrap(f'''<div class="sec">
<div style="display: flex; flex-direction: column; gap: 14px; max-width: 760px;"><p class="eyebrow">// savings calculator</p>
<h2 class="h2">What are your decisions costing you?</h2>
<p class="body">Plug in one decision-type call from your app. The share Jev handles comes from your shadow report. Until you run one, it&#39;s your estimate.</p></div>
<div class="calc">
<div class="panel calc-in">
{inp("calls", "Decisions per month", "1000000", 'step="1000"')}
<div class="g2" style="gap: 16px;">{inp("tin", "Input tokens / call", TIN)}{inp("tout", "Output tokens / call", TOUT)}</div>
{inp("qs", "Questions per call (fields in the answer)", QS, 'step="1"')}
<div class="field"><label class="lbl" for="model">Your current model</label><select class="in" id="model">{model_options()}</select>
<span class="small">OpenRouter list prices per 1M tokens, fetched {FETCHED}. Edit the prices below for a different model or a negotiated rate.</span></div>
<div class="g2" style="gap: 16px;">{inp("pin", "Input $ / 1M tokens", f'{CMP["in"]:g}', 'step="0.01"')}{inp("pout", "Output $ / 1M tokens", f'{CMP["out"]:g}', 'step="0.01"')}</div>
<div class="field"><label class="lbl" for="share">Share of calls Jev handles above your threshold: <span class="mono pink"><span id="o-share">85</span>%</span></label>
<input id="share" type="range" min="0" max="100" step="1" value="85" style="width: 100%; min-height: 44px;"></div>
</div>
<div class="calc-out" aria-live="polite">
<div style="display: flex; flex-direction: column; gap: 8px;"><span class="small mono" style="color: #A1A3A9;">you could save</span>
<span class="save"><span id="o-saveYear"></span><span style="font-size: 22px; color: #A1A3A9;"> / year</span></span>
<span class="body" style="font-size: 16px;"><span id="o-saveMonth"></span> a month · <span id="o-multiple"></span> lower cost on this call</span></div>
<div style="display: flex; flex-direction: column; gap: 18px;">
<div class="field"><div class="bar-row"><span>Today, all LLM</span><span class="mono"><span id="o-llmMonth"></span>/mo</span></div><div class="bar"><div style="width: 100%; background: #6B6E75;"></div></div></div>
<div class="field"><div class="bar-row"><span>Hybrid: Jev + LLM fallback</span><span class="mono"><span id="o-hybridMonth"></span>/mo</span></div><div class="bar"><div id="o-hybridBar" style="width: 0%; background: #F9B3C5;"></div></div></div>
<div class="field"><div class="bar-row"><span>All Jev</span><span class="mono"><span id="o-jevMonth"></span>/mo</span></div><div class="bar"><div id="o-jevBar" style="width: 0%; background: #D45BB6;"></div></div></div>
</div>
<p class="small">Hybrid = Jev on every call + your LLM on the share Jev isn&#39;t confident about. Jev priced at ${JEV["in"]:g} per 1M input tokens, output free. Jev input tokens = {PROF["baseTokens"]} + {PROF["perQuestion"]} per question + {PROF["stateFactor"]:g} × your input tokens, fitted from live calls. Check your provider&#39;s current rates, then measure with a shadow run.</p>
</div>
</div></div>''', id_="calculator")

    rows = [("0.5 ← recommended", "85.0%", "97.1%", True), ("0.6", "82.5%", "100.0%", False), ("0.7", "50.0%", "100.0%", False),
            ("0.8", "25.0%", "100.0%", False), ("0.9", "2.5%", "100.0%", False)]
    hi_attr = ' class="hi"'
    trs = "".join(f"<tr{hi_attr if h else ''}><td>{a}</td><td>{b}</td><td>{c}</td></tr>" for a, b, c, h in rows)
    report = wrap(f'''<div class="sec"><div class="row" style="align-items: flex-start; gap: 40px 56px;">
<div style="flex: 1 1 380px; display: flex; flex-direction: column; gap: 20px;"><p class="eyebrow">// the report</p>
<h2 class="h2">A report your team can review in the pull request.</h2>
<p class="body">Every shadow run writes a REPORT.md that drops straight into a pull request: agreement with your current model per field, a confidence-versus-coverage table, the recommended threshold, and cost per call on your real token counts.</p>
<p class="body">Measured on inputs your model already answered, not on a benchmark.</p></div>
<pre class="panel" style="flex: 1 1 480px; min-width: 0; padding: 24px 26px; font-size: 13.5px;"><span class="c-com"># jev-swap-out/REPORT.md</span>
<span class="c-kw">## triage-classifyTicket</span>  <span class="c-com">src/triage.ts:15</span>

Agreement with your model      <span class="c-com">per field: category, urgent, priority</span>
Coverage vs confidence         <span class="c-com">share of calls Jev answers at each threshold</span>
Recommended threshold          <span class="c-com">lowest one that meets your accuracy target</span>
Latency                        <span class="c-com">Jev p50 and p95 on your inputs</span>
Cost per call                  <span class="c-com">your model vs Jev vs hybrid, on your token counts</span></pre>
</div></div>''', id_="report")

    coverage = wrap(f'''<div class="sec"><h2 class="h2">Reads the SDKs you already use.</h2>
<div class="g2">
<div class="panel card"><p class="eyebrow">// ts · js</p><h3 class="h3">TypeScript &amp; JavaScript</h3>
<p class="body" style="font-size: 16px; line-height: 1.7;">OpenAI chat completions and Responses, Anthropic Messages including forced tool schemas, the Vercel AI SDK ({code("generateText")}, {code("generateObject")}, {code("Output.choice")}), and raw {code("fetch")}/axios calls to those APIs. Reads zod and JSON schema.</p></div>
<div class="panel card"><p class="eyebrow">// python</p><h3 class="h3">Python</h3>
<p class="body" style="font-size: 16px; line-height: 1.7;">OpenAI, Anthropic, LangChain&#39;s {code("with_structured_output")}, and raw {code("requests")}/{code("httpx")} calls. Reads Pydantic models, Enum classes, {code("Literal")}, {code("Field(ge, le)")} and JSON schema dicts, even when they live in another file.</p></div>
</div></div>''')

    qas = "".join([
        qa("Does it touch my code?", "No. It writes new modules and a report into " + code("jev-swap-out/") + ". You decide what to merge."),
        qa("Do I need a Jev API key to try it?", "Not to scan or convert. Shadow runs call Jev, so they need a TypeSafe API key in " + code("TYPESAFE_API_KEY") + "."),
        qa("What if Jev gets one wrong?", "Below the confidence threshold, the generated code calls your existing LLM instead. The shadow run sets that threshold from your data, against the accuracy target you choose."),
        qa("Is Jev always cheaper?", "No. Against mid-size and large models it is, by a wide margin. Against the cheapest small models, like Gemini Flash-Lite, the cost can come out about even or higher, and the case is speed. The explorer shows every call, including the ones with no saving."),
        qa("What won&#39;t it convert?", "Anything that generates text: summaries, drafts, explanations. Jev doesn&#39;t write, so those calls stay on your LLM, and any text fields mixed into a decision schema are flagged for review."),
        qa("Is this made by TypeSafe?", "No. jev-swap is an independent open-source tool built on TypeSafe&#39;s official SDKs."),
    ])
    faq = wrap(f'''<div class="sec"><div class="row" style="gap: 32px 48px;"><h2 class="h2" style="flex: 1 1 260px;">Questions</h2>
<div style="flex: 2 1 520px; display: flex; flex-direction: column; min-width: 0;">{qas}</div></div></div>''', id_="faq")

    install = wrap('''<div class="cta"><div style="flex: 1 1 400px; display: flex; flex-direction: column; gap: 20px;">
<h2 class="h2">See what your decisions cost. One command.</h2>
<p class="body" style="color: #1E1E1E;">Node 22.12+. Python 3.9+ on your PATH for Python projects.</p>
<div class="row" style="gap: 12px;"><a class="btn btn-dark" href="https://www.npmjs.com/package/jev-swap">npm package</a><a class="btn btn-dark" href="https://github.com/0xjba/jev-swap">View on GitHub</a></div></div>
<pre><span class="c-com"># run it on your app, no install needed</span>
npx jev-swap scan ./your-app
npx jev-swap convert
npx jev-swap shadow logs.jsonl \\
  --llm-price-in 2 --llm-price-out 10

<span class="c-com"># or install it</span>
npm install -g jev-swap</pre>
</div>''', id_="install")

    body = "\n".join([hero, facts, problem, speed, how, safety, teaser, trailer, calc, report, coverage, faq, install, footer(SOURCES)])
    return page("jev-swap — stop paying LLM prices for decisions",
                "Find the LLM calls in your codebase that are really decisions, see what they'd cost and how fast they'd run on TypeSafe Jev, and swap them with a safe fallback.",
                "index.html", body, extra_css=race_css, script=f"<script>{CALC_JS.replace('__JEV_IN__', format(JEV['in'], 'g')).replace('__JEV_BASE__', str(PROF['baseTokens'])).replace('__JEV_PERQ__', str(PROF['perQuestion'])).replace('__JEV_SF__', format(PROF['stateFactor'], 'g'))}</script>")


# ======================================================================
# SHADOW PROXY
# ======================================================================
def proxy_page():
    hero = wrap(f'''<div class="row hero-head">
<div class="hero-copy"><p class="eyebrow">// jev-swap shadow proxy</p>
<h1 class="h1">Mirror live traffic to Jev. <span class="pink">Change nothing.</span></h1></div>
<div class="hero-side"><p class="body">A local proxy between your app and OpenAI or Anthropic. Every request is forwarded unchanged; decision calls are also sent to Jev in parallel, and a live dashboard shows how the two compare on your real traffic.</p>
<div class="row" style="gap: 12px;"><a class="btn btn-fill" href="#run"><span class="kbd" aria-hidden="true">&gt;</span>Run the proxy</a><a class="btn btn-line" href="#measures">What it measures</a></div>
<p class="small">Runs on your machine. Your traffic never goes anywhere it doesn&#39;t already go, plus Jev.</p></div>
</div>
<div class="hero-art"><div class="d">{proxy_svg}</div><div class="m">{proxy_m_svg}</div></div>''', id_="top")

    steps = wrap('''<div class="sec">
<div style="display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// how it works</p><h2 class="h2">Your app keeps its model. Jev shadows it.</h2></div>
<div class="g3">
<article class="panel card"><div class="eyebrow">01 · point</div><h3 class="h3">Point your client at the proxy</h3><p class="body" style="font-size: 16px; line-height: 1.6;">Set the base URL of your OpenAI or Anthropic SDK to the proxy. Your API keys pass straight through.</p></article>
<article class="panel card"><div class="eyebrow">02 · mirror</div><h3 class="h3">Forward, and mirror decisions</h3><p class="body" style="font-size: 16px; line-height: 1.6;">Every request goes to your provider unchanged and your app gets its response. Requests that match a scanned decision call are also sent to Jev, in parallel.</p></article>
<article class="panel card"><div class="eyebrow">03 · decide</div><h3 class="h3">Compare, then apply</h3><p class="body" style="font-size: 16px; line-height: 1.6;">Once a call has enough mirrored samples and a confidence threshold meets your accuracy target, apply that threshold to the generated Jev module in one click.</p></article>
</div></div>''')

    shows = wrap('''<div class="sec" id="measures"><div class="row" style="gap: 32px 56px;">
<div style="flex: 1 1 380px; display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// the live dashboard</p>
<h2 class="h2">Measured on your traffic, not a benchmark.</h2></div>
<ul class="clean" style="flex: 1 1 480px;">
<li><strong style="color: #ECEDEF;">Agreement</strong> between Jev and your model, per decision call and per field.</li>
<li><strong style="color: #ECEDEF;">Latency</strong> of both, side by side, on the same requests.</li>
<li><strong style="color: #ECEDEF;">Savings so far</strong> at the prices you pass in.</li>
<li><strong style="color: #ECEDEF;">The confidence curve</strong>: how much traffic Jev covers at each threshold, and how accurate it is there.</li>
<li><strong style="color: #ECEDEF;">A disagreement inbox</strong> of the requests where the two answered differently.</li>
<li><strong style="color: #ECEDEF;">Replayable samples</strong>: mirrored calls are appended to <code class="code">proxy-samples.jsonl</code> in the format <code class="code">jev-swap shadow</code> reads.</li>
</ul></div></div>''')

    run = wrap('''<div class="sec" style="gap: 28px;">
<div style="display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// run it</p><h2 class="h2">Two environment variables.</h2></div>
<pre class="panel" style="padding: 22px 24px;"><span class="c-com">$</span> npx jev-swap scan ./your-app      <span class="c-com"># find the decision calls to mirror</span>
<span class="c-com">$</span> npx jev-swap convert
<span class="c-com">$</span> npx jev-swap proxy --llm-price-in 2 --llm-price-out 10

<span class="c-com"># point your app at it; API keys pass through untouched</span>
OPENAI_BASE_URL=<span class="c-str">http://localhost:8787/openai/v1</span>
ANTHROPIC_BASE_URL=<span class="c-str">http://localhost:8787/anthropic</span></pre>
<p class="small" style="font-size: 14px;">The proxy runs locally on port 8787 (change it with <code class="code">--port</code>) and serves its dashboard at <code class="code">http://localhost:8787/</code>. Mirroring to Jev needs a TypeSafe API key in <code class="code">TYPESAFE_API_KEY</code>.</p>
</div>''', id_="run")

    qas = "".join([
        qa("Does the proxy change my responses?", "No. Every request is forwarded to your provider unchanged and your app gets the provider&#39;s response. Jev only sees a copy of the decision calls, in parallel."),
        qa("Which requests are mirrored?", "Ones that match a call from " + code("jev-swap scan") + ", by output schema, enum values or yes/no prompt text. Two calls with identical schemas or prompts both match the first one scanned."),
        qa("What about streaming?", "Streaming requests are forwarded but not mirrored."),
        qa("What does Jev see?", "The last user message as its state, plus the typed questions for that call."),
        qa("Is the samples file safe to commit?", "No. " + code("proxy-samples.jsonl") + " contains your users&#39; inputs: keep it out of version control."),
    ])
    faq = wrap(f'''<div class="sec"><div class="row" style="gap: 32px 48px;"><h2 class="h2" style="flex: 1 1 260px;">Questions</h2>
<div style="flex: 2 1 520px; display: flex; flex-direction: column; min-width: 0;">{qas}</div></div></div>''')

    body = "\n".join([hero, steps, shows, run, faq, footer()])
    return page("Shadow proxy — jev-swap", "Mirror live OpenAI and Anthropic traffic to TypeSafe Jev without changing your app, and compare answers, latency and cost on your real requests.",
                "proxy.html", body)


# ======================================================================
# EXPLORER (public OSS results)
# ======================================================================
def model_name(key):
    return key.split("/", 1)[1] if "/" in key else key


def call_summary(c):
    """One comparable figure per call: its priced model, else its least favourable likely model."""
    if c["price"] and c["reductionAllJev"]:
        return {"kind": "known", "model": model_name(c["price"]["key"]), "red": c["reductionAllJev"],
                "speed": c["speed"]["speedup"] if c["speed"] else None, "verdict": c["verdict"], "others": []}
    if c["status"] == "model-unknown" and c["likelyModels"]:
        ms = sorted(c["likelyModels"], key=lambda m: m["reductionAllJev"]["low"])
        m = ms[0]
        return {"kind": "runtime", "model": model_name(m["key"]), "red": m["reductionAllJev"], "speed": m["speedup"],
                "verdict": m["verdict"], "others": [(model_name(x["key"]), x["reductionAllJev"]["low"], x["speedup"]) for x in ms[1:]]}
    if c["status"] == "price-unknown":
        return {"kind": "unpriced", "model": c["model"] or "", "red": None, "speed": None, "verdict": None, "others": []}
    return {"kind": "none", "model": "", "red": None, "speed": None, "verdict": "no-saving", "others": []}


def saving_of(sm):
    return sm["red"]["low"] if sm["red"] and sm["verdict"] in ("cheaper", "same-cost-faster") else None


def figure_of(sm):
    """A call's cost-reduction figure for medians: every priced call counts, savings or not.
    Known model: its low-end reduction (negative if Jev costs more). Runtime model: its least favourable likely
    model that saves, or 0 when none of its likely models saves. Unpriced models: None (left out)."""
    if sm["red"] is not None:
        return sm["red"]["low"]
    return 0.0 if sm["kind"] == "none" else None


def median(xs):
    xs = sorted(xs)
    if not xs:
        return None
    k = len(xs) // 2
    return xs[k] if len(xs) % 2 else (xs[k - 1] + xs[k]) / 2


def repo_stats(r):
    sms = [call_summary(c) for c in r["candidates"]]
    figs = [x for x in (figure_of(sm) for sm in sms) if x is not None]
    speeds = [sm["speed"] for sm in sms if sm["speed"]]
    return sms, median(figs), median(speeds)


TYPE_BADGE = {"choice": ("A|B", "choice"), "noul": ("Y/N", "yes / no"), "score": ("1–5", "score")}


def badges(c):
    out = []
    for f in c["fields"][:3]:
        label, kind = TYPE_BADGE.get(f["kind"], (f["kind"], f["kind"]))
        if f["kind"] == "score":
            label = f'{f.get("min")}–{f.get("max")}'
        detail = f'{f["name"]}: {kind}' + (f' · {len(f.get("options", []))} options' if f["kind"] == "choice" else "")
        out.append(f'<span class="dt dt-{f["kind"]}" title="{e(detail)}">{e(label)}</span>')
    if len(c["fields"]) > 3:
        out.append(f'<span class="dt" title="{e(", ".join(f["name"] for f in c["fields"][3:]))}">+{len(c["fields"]) - 3}</span>')
    return "".join(out)


def call_row(c, sm):
    base = c["file"].split("/")[-1]
    save = saving_of(sm)
    width = max(2, round(save * 100)) if save is not None else 0
    tone = "same" if sm["verdict"] == "same-cost-faster" else "cheaper"
    if sm["kind"] in ("known", "runtime") and save is not None:
        vs = f'vs {e(sm["model"])}' + (' <span class="rt" title="Model chosen at runtime: compared with the least favourable of its likely models">runtime</span>' if sm["kind"] == "runtime" else "")
        figs = f'<span class="cl-pct {tone}">{rng(sm["red"])}</span>' + (f'<span class="cl-x">{sm["speed"]:.1f}×</span>' if sm["speed"] and sm["speed"] >= 1.05 else "")
    elif sm["kind"] == "unpriced":
        vs, figs = f'{e(sm["model"])} · not priced', '<span class="cl-pct none">–</span>'
    else:
        vs = f'vs {e(sm["model"])}' if sm["model"] else "no likely model saves"
        figs = '<span class="cl-pct none">no saving</span>'
    title = f'{c["file"]}:{c["line"]}'
    if sm["others"]:
        title += " · also vs " + ", ".join(f'{m} {lo * 100:.0f}%' for m, lo, _ in sm["others"])
    partial = f'<span class="rt" title="Also returns {e(", ".join(c["droppedFields"]))}: free text Jev can&#39;t write, so the LLM call stays for those">partial</span>' if c["droppedFields"] else ""
    http = '<span class="rt" title="Raw HTTP call, no SDK">http</span>' if c["api"].startswith("http ") else ""
    return f"""<li class="cl">
<div class="cl-top"><a class="cl-file" href="{e(c["link"])}" title="{e(title)}">{e(base)}<span class="cl-line">:{c["line"]}</span></a><span class="cl-badges">{badges(c)}</span></div>
<div class="cl-bar" aria-hidden="true"><span class="{tone}" style="width: {width}%;"></span></div>
<div class="cl-meta"><span class="cl-vs">{vs}{partial}{http}</span><span class="cl-figs">{figs}</span></div>
</li>"""


def repo_card(r):
    sms, typ, spd = repo_stats(r)
    owner = r["repo"].split("/")[0]
    lic = r["license"] if r["license"] and r["license"] != "NOASSERTION" else "no license file"
    rows = sorted(zip(r["candidates"], sms), key=lambda cs: -(saving_of(cs[1]) if saving_of(cs[1]) is not None else -1))
    shown, more = rows[:4], rows[4:]
    more_html = (f'<details class="more"><summary>{len(more)} more call{"s" if len(more) != 1 else ""}</summary>'
                 f'<ul class="cls">{"".join(call_row(c, sm) for c, sm in more)}</ul></details>') if more else ""
    n = len(r["candidates"])
    return f"""<article class="panel rc">
<header class="rc-head"><img class="av" src="https://github.com/{e(owner)}.png?size=80" alt="" width="40" height="40" loading="lazy">
<div class="rc-id"><a class="rc-name" href="{e(r["url"])}"><span class="rc-owner">{e(owner)}/</span>{e(r["repo"].split("/", 1)[1])}</a>
<span class="meta">★ {stars(r["stars"])} · {e(lic)}</span></div></header>
<div class="rc-stats">
<div><span class="rc-big {"pink" if typ is not None and typ >= 0.05 else ""}">{pct(typ) if typ is not None and typ >= 0.05 else ("none" if typ is not None else "–")}</span><span class="rc-lbl">typical saving</span></div>
<div><span class="rc-big">{f"{spd:.1f}×" if spd else "–"}</span><span class="rc-lbl">faster</span></div>
<div><span class="rc-big">{n}</span><span class="rc-lbl">decision call{"s" if n != 1 else ""}</span></div>
</div>
<ul class="cls">{"".join(call_row(c, sm) for c, sm in shown)}</ul>
{more_html}
</article>"""


def explorer_page():
    if not DASH:
        return None
    d, t = DASH, DASH["totals"]
    T = typical()
    featured = [r for r in d["repos"] if r["featured"]]
    m = d["methodology"]

    head = wrap(f"""<div class="sec" style="padding-bottom: 56px;">
<div class="row" style="justify-content: space-between; align-items: flex-end; gap: 24px 64px;">
<div style="flex: 1 1 560px; display: flex; flex-direction: column; gap: 18px;"><p class="eyebrow">// open-source explorer</p>
<h1 class="h1" style="font-size: 56px;">Decisions open-source code could run on Jev.</h1></div>
<p class="body" style="flex: 1 1 360px; max-width: 460px;">LLM calls in public repos that only return a label, a yes/no or a score, and what each could save in cost and time on TypeSafe Jev. Percentages only: traffic is unknown, and it cancels out of a percentage.</p>
</div>
<div class="stat-row">
<div class="stat"><span class="stat-big">{t["reposScanned"]:,}</span><span class="small">public repos scanned</span></div>
<div class="stat"><span class="stat-big">{t["reposWithCandidates"]}</span><span class="small">with decision calls in production code</span></div>
<div class="stat"><span class="stat-big">{t["candidates"]}</span><span class="small">decision calls found</span></div>
<div class="stat"><span class="stat-big pink">{pct(T["save"])} · {T["speed"]:.1f}×</span><span class="small">median cost cut and speedup per decision call</span></div>
</div>
<p class="small">Data as of {d["generatedAt"][:10]}; prices and latency from OpenRouter. Where the code names its model and every field maps to Jev, the median is {pct(t["medianReductionLow"])}; where the model is chosen at runtime, it&#39;s {pct(t["likely"]["medianConservativeReductionLow"])} against the least favourable likely model. <a href="#method">How we calculate this</a> · <a href="data/explorer.json">Download the data</a></p>
</div>""", id_="top")

    feat = wrap(f"""<div class="sec">
<div style="display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// featured</p>
<h2 class="h2">Widely used projects with decision calls.</h2>
<p class="body">A selection of widely used open-source projects. Every repo we found, big or small, is in the full list below. Bars show each call&#39;s saving; hover a file for its full path and other models.</p></div>
<div class="g-repos">{"".join(repo_card(r) for r in featured)}</div>
</div>""", id_="featured")

    def row(r):
        sms, typ, spd = repo_stats(r)
        owner = r["repo"].split("/")[0]
        save_attr = f"{typ:.4f}" if typ is not None else "-1"
        cell = (f'<div class="tsave"><div class="cl-bar" aria-hidden="true"><span class="cheaper" style="width: {max(2, round(typ * 100))}%;"></span></div><span class="cl-pct cheaper">{pct(typ)}</span></div>'
                if typ is not None and typ >= 0.05 else '<span class="cl-pct none">no saving</span>')
        q = e((r["repo"] + " " + " ".join(c["file"] for c in r["candidates"])).lower())
        return (f'<tr data-q="{q}" data-stars="{r["stars"]}" data-calls="{len(r["candidates"])}" data-save="{save_attr}">'
                f'<td><a class="trepo" href="{e(r["url"])}"><img class="av av-s" src="https://github.com/{e(owner)}.png?size=48" alt="" width="22" height="22" loading="lazy">{e(r["repo"])}</a></td>'
                f'<td class="num">{stars(r["stars"])}</td><td class="num">{len(r["candidates"])}</td><td>{cell}</td></tr>')

    ordered = sorted(d["repos"], key=lambda r: -(repo_stats(r)[1] if repo_stats(r)[1] is not None else -1))
    everything = wrap(f"""<div class="sec">
<div style="display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// every repo</p>
<h2 class="h2">All repos with decision calls.</h2>
<p class="body">Well-known and less-known repos alike. Typical saving is the median across a repo&#39;s calls.</p></div>
<div class="tools">
<div class="field filter"><label class="lbl" for="q">Filter by repo or file</label><input class="in" id="q" type="search" placeholder="e.g. firecrawl, triage" autocomplete="off"></div>
<div class="field"><span class="lbl" id="sort-lbl">Sort by</span><div class="seg" role="group" aria-labelledby="sort-lbl">
<button type="button" class="chip" data-sort="save" aria-pressed="true">Saving</button><button type="button" class="chip" data-sort="calls" aria-pressed="false">Calls</button><button type="button" class="chip" data-sort="stars" aria-pressed="false">Stars</button></div></div>
</div>
<div class="tbl-wrap panel" style="padding: 8px 16px;"><table class="all-table"><thead><tr><th scope="col">Repo</th><th scope="col" class="num">Stars</th><th scope="col" class="num">Calls</th><th scope="col">Typical saving</th></tr></thead><tbody id="rows">{"".join(row(r) for r in ordered)}</tbody></table></div>
<p class="small" id="count"></p>
</div>""", id_="all")

    formulas = "\n".join(e(f) for f in m["formulas"])
    assumptions = "".join(f"<li>{e(a)}</li>" for a in m["assumptions"])
    method = wrap(f"""<div class="sec"><div class="row" style="gap: 32px 56px; align-items: flex-start;">
<div style="flex: 1 1 320px; display: flex; flex-direction: column; gap: 14px;"><p class="eyebrow">// methodology</p>
<h2 class="h2">How we calculate this.</h2>
<p class="body">Static estimates from each call&#39;s source, list prices and public latency stats. A shadow run on real traffic measures the real numbers.</p></div>
<div style="flex: 2 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 20px;">
<div class="formula">{formulas}</div>
<ul class="clean">{assumptions}</ul>
<p class="small">Jev at ${m["jevPrice"]["in"]:g} per 1M input tokens, output free (<a href="{e(m["jevPrice"]["source"])}">OpenRouter</a>, checked {m["jevPrice"]["checked"]}). Input-size range: {m["stateTokenRange"][0]}–{m["stateTokenRange"][1]} tokens per call.</p>
</div></div></div>""", id_="method")

    optout = wrap("""<div class="sec" style="gap: 20px;">
<p class="eyebrow">// maintainers</p>
<h2 class="h2">Your repo is listed and you&#39;d rather it wasn&#39;t, or a call is wrong?</h2>
<p class="body" style="max-width: 720px;">Open an issue at <a href="https://github.com/0xjba/jev-swap">https://github.com/0xjba/jev-swap</a> and we&#39;ll remove it or correct it on the next build. We store only the repo name, commit, file and line, schema shape, model and token counts: never code or prompt text. To see real numbers for your project instead of estimates, run <code class="code">jev-swap shadow</code> on your own traffic.</p>
</div>""")

    script = """<script>
(function () {
  var q = document.getElementById('q'), body = document.getElementById('rows'), count = document.getElementById('count');
  var rows = [].slice.call(body.querySelectorAll('tr'));
  var buttons = [].slice.call(document.querySelectorAll('[data-sort]'));
  var key = 'save';
  function apply() {
    var v = (q.value || '').trim().toLowerCase(), n = 0;
    rows.sort(function (a, b) { return Number(b.getAttribute('data-' + key)) - Number(a.getAttribute('data-' + key)); });
    rows.forEach(function (r) {
      var show = !v || r.getAttribute('data-q').indexOf(v) !== -1;
      r.hidden = !show; if (show) n++;
      body.appendChild(r);
    });
    count.textContent = n + ' of ' + rows.length + ' repos';
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      key = b.getAttribute('data-sort');
      buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      apply();
    });
  });
  q.addEventListener('input', apply); apply();
})();
</script>"""
    body = "\n".join([head, feat, everything, method, optout, footer(SOURCES)])
    return page("Open-source explorer — jev-swap", "Public repos whose LLM calls are really decisions, and what each could save in cost and time on TypeSafe Jev.",
                "explorer.html", body, script=script)


def typical():
    """Median saving and speedup across every Explorer call that saves (same per-call rule as the repo cards)."""
    if not DASH:
        return None
    sms = [call_summary(c) for r in DASH["repos"] for c in r["candidates"]]
    figs = [x for x in (figure_of(sm) for sm in sms) if x is not None]
    speeds = [sm["speed"] for sm in sms if sm["speed"]]
    return {"calls": len(sms), "priced": len(figs), "no_saving": sum(1 for x in figs if x < 0.05),
            "repos": DASH["totals"]["reposWithCandidates"], "scanned": DASH["totals"]["reposScanned"],
            "save": median(figs), "speed": median(speeds), "date": DASH["generatedAt"][:10]}


def write(name, text):
    with open(os.path.join(SITE, name), "w") as fh:
        fh.write(text)
    print(f"wrote site/{name} ({len(text):,} bytes)")


write("index.html", home())
write("proxy.html", proxy_page())
explorer = explorer_page()
if explorer:
    write("explorer.html", explorer)
    os.makedirs(os.path.join(SITE, "data"), exist_ok=True)
    shutil.copyfile(dash_path, os.path.join(SITE, "data", "explorer.json"))
    print("copied oss-out/dashboard.json -> site/data/explorer.json")
    for old in ("dashboard.html", os.path.join("data", "dashboard.json")):  # renamed to the explorer
        if os.path.exists(os.path.join(SITE, old)):
            os.remove(os.path.join(SITE, old))
else:
    print("no oss-out/dashboard.json: skipped explorer.html (run `node dist/cli.js oss build` first)")
print(f"Comparison model {CMP_KEY}: {REDUCTION:.1f}% lower, {MULTIPLE:.1f}x cheaper; LLM ~{LLM_MS:.0f} ms vs Jev {JEV_MS} ms" if LLM_MS else "")
