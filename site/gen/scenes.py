from iso import Scene, MONO, LABEL, LINE, EDGE, C as C_, S as S_

# TypeSafe brand pinks (typesafe.ai stylesheet, checked 2026-09-23): #F386A1 fills, #D45BB6 hover/selection
ACC = "#F386A1"
ACC_L = "#D45BB6"
ACC_D = "#A8428F"
ACC_T = "#F386A1"
TXT = "#ECEDEF"
TILE = "#3C3D42"
CUBE = ("#2E2F33", "#232427", "#1C1D20")
SLAB = "#141416"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ======================================================================
# HERO: your app -> shadow proxy -> (your LLM, unchanged) + (Jev, mirrored)
# ======================================================================
def hero():
    s = Scene()
    z = 9
    jev_pulse = lambda a: {"anim": a, "color": ACC_T}
    llm_pulse = lambda a: {"anim": a, "color": "#FFFFFF"}

    # ---- wires (drawn first; objects cover their ends) ----
    s.wire([(68, 428, z), (68, 266, z)], pulse=llm_pulse("run-a"))                                   # app -> proxy
    s.wire([(266, 60, z), (388, 60, z), (388, -194, z)], pulse=jev_pulse("run-b"), color=ACC_T)       # proxy -> jev
    s.wire([(416, -222, z), (470, -222, z), (470, 130, z), (266, 130, z)], dashed=True,
           pulse=jev_pulse("run-c"), color=ACC_T)                                                     # jev -> proxy
    s.wire([(266, 200, z), (628, 200, z), (628, 96, z)], pulse=llm_pulse("run-d"))                    # proxy -> llm
    s.wire([(656, 68, z), (720, 68, z), (720, 560, z), (68, 560, z), (68, 456, z)], dashed=True,
           pulse=llm_pulse("run-e"))                                                                  # llm -> app

    # ---- comparison slabs sliding out beneath the proxy ----
    slabs = [
        # (x, y, cls, lines, dashed)
        (0, 90, "slab-agree", ["agree", "same label: billing"], False),
        (130, 90, "slab-more", ["+ latency, cost", "per call, per field"], True),
        (0, 220, "slab-llm", ["llm answer", "billing"], False),
        (130, 220, "slab-jev", ["jev answer", "billing · conf 0.94"], False),
    ]
    for x, y, cls, lines, dashed in slabs:
        s.add(f'<g class="slab {cls}">')
        if dashed:
            s.rect_top(x, y, -70, 118, 118, "none", stroke="#6C6F77", dash="4 4")
        else:
            s.box(x, y, -78, 118, 118, 8, SLAB, "#0D0D0F", "#0B0B0C", stroke="rgba(236,237,239,0.14)")
        zt = -70
        col = ACC_T if cls == "slab-jev" else TXT
        s.text_x(x + 12, y + 98, zt, esc(lines[0]), size=10, fill=col if cls != "slab-more" else LABEL)
        s.text_x(x + 12, y + 110, zt, esc(lines[1]), size=8.5, fill=LABEL)
        s.add("</g>")

    # ---- the proxy platform ----
    s.box(0, 0, 0, 266, 266, 18, "#26272B", ACC_L, ACC_D, stroke="rgba(243,134,161,0.55)")
    T, G, PAD = 70, 12, 16
    tiles = {
        (0, 0): "match", (2, 0): "mirror", (1, 1): "compare", (0, 2): "latency", (2, 2): "cost",
    }
    for r in range(3):
        for c in range(3):
            x, y = PAD + c * (T + G), PAD + r * (T + G)
            name = tiles.get((c, r))
            if name:
                s.box(x, y, 18, T, T, 5, TILE, "#2A2B2F", "#222326", extra_top=f' class="tile t-{name}"')
                s.text_x(x + 10, y + T - 12, 23, name, size=9, fill=TXT)
            else:
                s.rect_top(x, y, 18, T, T, "none", stroke="rgba(236,237,239,0.18)", dash="3 4")

    # endpoint dots on visible faces
    for p in [(68, 266, z), (266, 60, z), (266, 130, z), (266, 200, z)]:
        s.dot(*p, r=2.6)

    # ---- cubes ----
    s.box(360, -250, 0, 56, 56, 56, ACC, ACC_L, ACC_D, stroke="rgba(243,134,161,0.7)")                 # jev
    s.text_x(372, -214, 56, "jev", size=12, fill="#1E1E1E", weight=600)
    s.box(600, 40, 0, 56, 56, 56, *CUBE)                                                              # llm
    s.text_x(613, 76, 56, "llm", size=12, fill=TXT, weight=500)
    s.box(40, 400, 0, 56, 56, 56, *CUBE)                                                              # app
    s.text_x(53, 436, 56, "&lt;/&gt;", size=12, fill=TXT, weight=500)
    for p in [(388, -194, z), (416, -222, z), (628, 96, z), (656, 68, z), (68, 456, z)]:
        s.dot(*p, r=2.6)

    # ---- labels on the ground plane ----
    s.text_negy(-20, 258, 0, "// jev-swap shadow proxy", size=10, fill=TXT)
    s.text_x(40, 478, 0, "// your app", size=9.5)
    s.text_x(360, -176, 0, "// jev · system one", size=9.5, fill=ACC_T)
    s.text_x(360, -164, 0, "70–500 ms · $0.042 / 1M in", size=8.5, fill=LABEL)
    s.text_x(600, 118, 0, "// your llm", size=9.5)
    s.text_x(600, 130, 0, "e.g. haiku 4.5 · $1 in / $5 out", size=8.5, fill=LABEL)
    s.text_x(292, 212, z, "// forwarded unchanged", size=8.5)
    s.text_negy(398, 44, z, "// mirrored in parallel", size=8.5, fill=ACC_T)
    s.text_negy(480, 118, z, "// typed answer + confidence", size=8.5, fill=ACC_T)
    s.text_x(236, 572, z, "// your response, untouched", size=8.5)

    # ---- code panel above the app, wired straight down ----
    top = s.P(68, 428, 196)
    bottom = s.P(68, 428, 56)
    s.screen_wire([top, bottom])
    s.dot(68, 428, 196, r=2.6)
    px, py = top[0] - 150, top[1] - 176
    w, h = 372, 176
    s.pts += [(px, py), (px + w, py + h)]
    s.add(f'<rect x="{s.f(px)}" y="{s.f(py)}" width="{w}" height="{h}" rx="3" fill="#111113" stroke="rgba(236,237,239,0.14)"></rect>')
    s.text_flat(px + 14, py + 20, "your app · triage.ts", size=9, fill=LABEL)
    s.text_flat(px + w - 14, py + 20, "live", size=9, fill="#B6D98A", anchor="end")
    code = [
        [("// point your SDK at the shadow proxy", "#7C7F87")],
        [("const ", "#E3C07A"), ("openai = ", TXT), ("new ", "#E3C07A"), ("OpenAI({", TXT)],
        [("  baseURL: ", TXT), ('"http://localhost:8787/openai/v1"', ACC_T)],
        [("});", TXT)],
        [("const ", "#E3C07A"), ("t = ", TXT), ("await ", "#E3C07A"), ("openai.chat.completions.parse({", TXT)],
        [("  model: ", TXT), ('"gpt-5.6-terra"', ACC_T), (",", TXT)],
        [("  response_format: ", TXT), ("zodResponseFormat", "#9CC9A8"), ("(Ticket, ", TXT), ('"t"', ACC_T), ("),", TXT)],
        [("});", TXT)],
    ]
    for i, line in enumerate(code):
        spans = "".join(f'<tspan fill="{c}">{esc(t)}</tspan>' for t, c in line)
        yy = py + 46 + i * 16
        s.add(f'<text x="{s.f(px + 14)}" y="{s.f(yy)}" font-family="{MONO}" font-size="10.5" style="white-space: pre;">{spans}</text>')

    return s.svg(pad=28, label="Your app sends its LLM call through the jev-swap shadow proxy. The proxy forwards it unchanged to your LLM and mirrors it to Jev in parallel, then compares the two answers, their latency and their cost.", cls="iso hero-iso")


# ======================================================================
# GATE: confidence threshold routing (safety net)
# ======================================================================
def gate():
    """Portrait: decisions drop into the gate; >= threshold goes to Jev (left), below to your LLM (right)."""
    s = Scene()
    z = 8
    top = s.P(28, 28, 170)
    s.screen_wire([top, s.P(28, 28, 56)], pulse={"anim": "g-in", "color": "#FFFFFF"})
    s.dot(28, 28, 170, r=3)
    s.wire([(28, 56, z), (28, 170, z)], pulse={"anim": "g-jev", "color": ACC_T}, color=ACC_T)
    s.wire([(56, 28, z), (170, 28, z)], dashed=True, pulse={"anim": "g-llm", "color": "#FFFFFF"})
    s.box(-27, 170, 0, 110, 110, 12, "#26272B", ACC_L, ACC_D, stroke="rgba(243,134,161,0.55)")
    s.text_x(-15, 262, 12, "jev answer", size=13, fill=TXT)
    s.box(170, 0, 0, 56, 56, 56, *CUBE)
    s.text_x(181, 36, 56, "llm", size=15, fill=TXT, weight=500)
    s.box(0, 0, 0, 56, 56, 56, *CUBE)
    s.text_x(6, 36, 56, "≥ t ?", size=14, fill=TXT, weight=500)
    for p in [(28, 56, z), (56, 28, z)]:
        s.dot(*p, r=3)
    tx, ty = top
    s.text_flat(tx + 10, ty + 4, "// every decision", size=13)
    s.text_negy(-40, 150, z, "// confidence ≥ THRESHOLD", size=12, fill=ACC_T)
    s.text_x(84, 84, z, "// below: your existing call", size=12)
    return s.svg(pad=20, label="Each decision reaches a confidence gate. Above the threshold the Jev answer is used; below it, your existing LLM call runs.", cls="iso")


# ======================================================================
# STEP ICONS: scan, convert, shadow
# ======================================================================
def icon_scan():
    s = Scene()
    s.box(0, 0, 0, 60, 60, 60, *CUBE)
    s.text_x(12, 36, 60, "&lt;/&gt;", size=12, fill=TXT)
    s.add('<g class="scanline">')
    s.rect_top(-14, -14, 30, 88, 88, "rgba(94,130,230,0.12)", stroke=ACC_T, dash="4 4")
    s.add("</g>")
    return s.svg(pad=10, label="", cls="iso icon")[0]


def icon_convert():
    s = Scene()
    s.box(0, 60, 0, 56, 56, 22, *CUBE)
    s.text_x(8, 104, 22, "llm()", size=10, fill=TXT)
    s.wire([(56, 88, 11), (100, 88, 11), (100, 30, 11)], pulse={"anim": "i-conv", "color": ACC_T}, color=ACC_T)
    s.box(76, -40, 0, 64, 64, 12, "#26272B", ACC_L, ACC_D, stroke="rgba(243,134,161,0.55)")
    s.text_x(86, 8, 12, "jev", size=10, fill=TXT)
    return s.svg(pad=10, label="", cls="iso icon")[0]


def icon_shadow():
    s = Scene()
    s.box(0, 0, 0, 90, 90, 10, "#26272B", ACC_L, ACC_D, stroke="rgba(243,134,161,0.55)")
    s.text_x(10, 78, 10, "jev", size=10, fill=TXT)
    s.wire([(45, 45, 10), (45, 45, 44)], dashed=True, pulse={"anim": "i-shadow", "color": ACC_T}, color=ACC_T)
    s.box(0, 0, 44, 90, 90, 10, *CUBE)
    s.text_x(10, 78, 54, "your llm", size=10, fill=TXT)
    return s.svg(pad=10, label="", cls="iso icon")[0]


# ======================================================================
# HERO (phone): the same flow, stacked vertically with larger labels
# ======================================================================
def hero_mobile():
    s = Scene()
    z = 9
    jp = lambda a: {"anim": a, "color": ACC_T}
    lp = lambda a: {"anim": a, "color": "#FFFFFF"}
    app_to_proxy = [(28, 28, z), (28, 150, z), (120, 150, z)]
    to_llm = [(300, 320, z), (300, 446, z)]
    to_jev = [(320, 300, z), (446, 300, z)]
    s.wire(app_to_proxy, pulse=lp("m-a"))
    s.wire(list(reversed(app_to_proxy)), pulse=lp("m-f"), opacity=0)
    s.wire(to_jev, pulse=jp("m-b"), color=ACC_T)
    s.wire(list(reversed(to_jev)), pulse=jp("m-c"), opacity=0)
    s.wire(to_llm, pulse=lp("m-d"))
    s.wire(list(reversed(to_llm)), pulse=lp("m-e"), opacity=0)

    # comparison slab beneath, between the two models
    s.add('<g class="slab slab-llm">')
    s.box(420, 420, -40, 150, 150, 8, SLAB, "#0D0D0F", "#0B0B0C", stroke="rgba(236,237,239,0.14)")
    s.text_x(432, 522, -32, "llm: billing", size=12, fill=TXT)
    s.text_x(432, 538, -32, "jev: billing · 0.94", size=12, fill=ACC_T)
    s.text_x(432, 554, -32, "agree · faster · cheaper", size=10.5, fill=LABEL)
    s.add("</g>")

    # proxy platform
    s.box(120, 120, 0, 200, 200, 16, "#26272B", ACC_L, ACC_D, stroke="rgba(243,134,161,0.55)")
    T, G, PAD = 52, 10, 12
    tiles = {(0, 0): "match", (2, 0): "mirror", (1, 1): "compare", (0, 2): "latency", (2, 2): "cost"}
    for r in range(3):
        for c in range(3):
            x, y = 120 + PAD + c * (T + G), 120 + PAD + r * (T + G)
            name = tiles.get((c, r))
            if name:
                s.box(x, y, 16, T, T, 4, TILE, "#2A2B2F", "#222326", extra_top=f' class="tile t-{name}"')
                s.text_x(x + 6, y + T - 9, 20, name, size=9.5, fill=TXT)
            else:
                s.rect_top(x, y, 16, T, T, "none", stroke="rgba(236,237,239,0.18)", dash="3 4")
    for p in [(300, 320, z), (320, 300, z)]:
        s.dot(*p, r=3)

    # cubes
    s.box(0, 0, 0, 56, 56, 56, *CUBE)
    s.text_x(10, 36, 56, "&lt;/&gt;", size=14, fill=TXT, weight=500)
    s.box(273, 446, 0, 56, 56, 56, *CUBE)
    s.text_x(284, 482, 56, "llm", size=15, fill=TXT, weight=500)
    s.box(446, 273, 0, 56, 56, 56, ACC, ACC_L, ACC_D, stroke="rgba(243,134,161,0.7)")
    s.text_x(457, 309, 56, "jev", size=15, fill="#1E1E1E", weight=600)

    # labels
    s.text_x(-2, 76, 0, "// your app", size=12)
    s.text_negy(104, 312, 0, "// shadow proxy", size=12.5, fill=TXT)
    s.text_x(273, 518, 0, "// your llm", size=12)
    s.text_x(273, 532, 0, "forwarded unchanged", size=10.5, fill=LABEL)
    s.text_x(446, 345, 0, "// jev · mirrored", size=12, fill=ACC_T)
    s.text_x(446, 359, 0, "70–500 ms", size=10.5, fill=LABEL)
    s.text_x(446, 373, 0, "$0.042 / 1M in", size=10.5, fill=LABEL)

    # code panel above the app
    top = s.P(28, 28, 150)
    s.screen_wire([top, s.P(28, 28, 56)])
    s.dot(28, 28, 150, r=3)
    w, h = 340, 150
    px, py = top[0] - w / 2, top[1] - h
    s.pts += [(px, py), (px + w, py + h)]
    s.add(f'<rect x="{s.f(px)}" y="{s.f(py)}" width="{w}" height="{h}" rx="3" fill="#111113" stroke="rgba(236,237,239,0.14)"></rect>')
    s.text_flat(px + 14, py + 22, "your app · triage.ts", size=11, fill=LABEL)
    code = [
        [("// point your SDK at the proxy", "#7C7F87")],
        [("new ", "#E3C07A"), ("OpenAI({", TXT)],
        [("  baseURL: ", TXT), ('"http://localhost:8787', ACC_T)],
        [('            /openai/v1"', ACC_T)],
        [("});", TXT)],
    ]
    for i, line in enumerate(code):
        spans = "".join(f'<tspan fill="{c}">{esc(t)}</tspan>' for t, c in line)
        s.add(f'<text x="{s.f(px + 14)}" y="{s.f(py + 50 + i * 19)}" font-family="{MONO}" font-size="12.5" style="white-space: pre;">{spans}</text>')

    return s.svg(pad=16, label="Your app sends its LLM call through the jev-swap shadow proxy, which forwards it unchanged to your LLM and mirrors it to Jev in parallel, then compares answers, latency and cost.", cls="iso hero-iso")


# ======================================================================
# HOME HERO: scan a codebase -> decision calls light up -> sorted into choice / yes-no / score -> Jev
# ======================================================================
from iso import KEYFRAMES  # noqa: E402

FILES = [
    [("triage.ts", True), ("api.ts", False), ("spam.py", True), ("db.py", False)],
    [("chat.ts", False), ("moderate.ts", True), ("utils.py", False), ("summarize.ts", False)],
    [("auth.ts", False), ("refunds.py", True), ("billing.ts", False), ("route.ts", True)],
]
_found = [0]


def _found_class(frac, cycle=6, sweep=(8, 46)):
    """A tile that lights up pink when the scan beam passes (frac = 0..1 across the codebase) and stays lit."""
    _found[0] += 1
    name = f"fd{_found[0]}"
    at = sweep[0] + frac * (sweep[1] - sweep[0])
    KEYFRAMES.append(f"@keyframes {name}{{0%,{at:.1f}%{{fill:#3C3D42}}{at + 1.5:.1f}%,90%{{fill:#F386A1}}96%,100%{{fill:#3C3D42}}}}")
    KEYFRAMES.append(f".{name}{{animation:{name} {cycle}s linear infinite}}")
    return name


def hero_scan():
    s = Scene()
    z = 7
    T, G, PAD = 62, 10, 14
    W, D = 4 * T + 3 * G + 2 * PAD, 3 * T + 2 * G + 2 * PAD  # 306 x 234

    # wires: codebase -> the three decision types -> Jev
    rows_y = [PAD + r * (T + G) + T / 2 for r in range(3)]
    for y in rows_y:
        s.wire([(W, y, z), (400, y, z)], pulse={"anim": "s-out", "color": ACC_T}, color=ACC_T)
    s.wire([(510, rows_y[0], z), (628, rows_y[0], z), (628, 90, z)], pulse={"anim": "s-jev", "color": ACC_T}, color=ACC_T)
    s.wire([(510, rows_y[1], z), (600, rows_y[1], z)], pulse={"anim": "s-jev", "color": ACC_T}, color=ACC_T)
    s.wire([(510, rows_y[2], z), (628, rows_y[2], z), (628, 146, z)], pulse={"anim": "s-jev", "color": ACC_T}, color=ACC_T)

    # the codebase
    s.box(0, 0, 0, W, D, 14, "#26272B", "#232427", "#1C1D20", stroke="rgba(236,237,239,0.22)")
    n_cols = 4
    for r, row in enumerate(FILES):
        for c, (name, found) in enumerate(row):
            x, y = PAD + c * (T + G), PAD + r * (T + G)
            if found:
                cls = _found_class(c / (n_cols - 1))
                s.box(x, y, 14, T, T, 4, TILE, "#2A2B2F", "#222326", extra_top=f' class="{cls}"')
                s.text_x(x + 7, y + T - 9, 18, name, size=8.5, fill=TXT)
            else:
                s.rect_top(x, y, 14, T, T, "none", stroke="rgba(236,237,239,0.2)", dash="3 4")
                s.text_x(x + 7, y + T - 9, 14, name, size=8.5, fill="#6C6F77")
    # scan beam sweeping along +x
    s.add('<g class="beam">')
    s.rect_top(-4, -10, 26, 10, D + 20, "rgba(243,134,161,0.22)", stroke="#F386A1")
    s.add("</g>")
    for y in rows_y:
        s.dot(W, y, z, r=2.6)

    # decision types
    slabs = [("choice", "category · 3 options"), ("yes / no", "urgent · confidence"), ("score", "priority · 1–5")]
    for (title, sub), y in zip(slabs, rows_y):
        y0 = y - 40
        s.box(400, y0, 0, 110, 80, 10, SLAB, "#0D0D0F", "#0B0B0C", stroke="rgba(243,134,161,0.45)")
        s.text_x(410, y0 + 56, 10, title, size=11, fill=ACC_T, weight=500)
        s.text_x(410, y0 + 70, 10, sub, size=8.5, fill=LABEL)

    # Jev
    s.box(600, 90, 0, 56, 56, 56, ACC, ACC_L, ACC_D, stroke="rgba(243,134,161,0.7)")
    s.text_x(612, 126, 56, "jev", size=12, fill="#1E1E1E", weight=600)
    s.dot(628, 146, z, r=2.6)

    # labels
    s.text_negy(-18, D - 4, 0, "// your codebase", size=10, fill=TXT)
    s.text_x(400, D + 18, 0, "// decisions found", size=9.5)
    s.text_x(600, 166, 0, "// typed answers on jev", size=9.5, fill=ACC_T)
    s.text_x(600, 178, 0, "cost + speed vs your model", size=8.5)
    s.text_x(600, 190, 0, "llm fallback below threshold", size=8.5)

    # terminal panel, wired down onto the codebase
    top = s.P(40, 190, 170)
    s.screen_wire([top, s.P(40, 190, 14)], pulse={"anim": "s-panel", "color": ACC_T})
    s.dot(40, 190, 170, r=2.6)
    w, h = 356, 150
    px, py = top[0] - 120, top[1] - h
    s.pts += [(px, py), (px + w, py + h)]
    s.add(f'<rect x="{s.f(px)}" y="{s.f(py)}" width="{w}" height="{h}" rx="3" fill="#111113" stroke="rgba(236,237,239,0.14)"></rect>')
    lines = [
        [("$ ", "#7C7F87"), ("jev-swap scan ./app", TXT)],
        [("Found 5 candidate(s):", "#7C7F87")],
        [("triage.ts:15   ", ACC_T), ("category urgent priority", TXT)],
        [("spam.py:8      ", ACC_T), ("answer (yes/no)", TXT)],
        [("moderate.ts:6  ", ACC_T), ("action contains_pii", TXT)],
        [("refunds.py:9   ", ACC_T), ("decision fraud_risk", TXT)],
        [("route.ts:21    ", ACC_T), ("intent", TXT)],
    ]
    for i, line in enumerate(lines):
        spans = "".join(f'<tspan fill="{c}">{esc(t)}</tspan>' for t, c in line)
        s.add(f'<text x="{s.f(px + 14)}" y="{s.f(py + 24 + i * 17)}" font-family="{MONO}" font-size="10.5" style="white-space: pre;">{spans}</text>')

    # beam path in screen space: +x by W+8 iso units
    dx, dy = (W + 8) * C_, (W + 8) * S_
    KEYFRAMES.append(f"@keyframes beam{{0%,{8 - 1}%{{transform:translate(0px,0px);opacity:0}}8%{{opacity:1}}46%{{transform:translate({dx:.1f}px,{dy:.1f}px);opacity:1}}48%,100%{{transform:translate({dx:.1f}px,{dy:.1f}px);opacity:0}}}}")
    KEYFRAMES.append(".beam{animation:beam 6s linear infinite}")
    return s.svg(pad=24, label="jev-swap scans your codebase, lights up the LLM calls that are really decisions, sorts them into choice, yes/no and score questions, and runs them on Jev with your LLM as the fallback.", cls="iso hero-iso")


def hero_scan_mobile():
    s = Scene()
    z = 7
    T, G, PAD = 52, 10, 12
    W, D = 3 * T + 2 * G + 2 * PAD, 4 * T + 3 * G + 2 * PAD  # 200 x 262
    files = [f for row in FILES for f in row]
    grid = [files[i * 3:(i + 1) * 3] for i in range(4)]

    # codebase -> first slab, then down the stack to jev (vertical screen wires)
    s.wire([(W, 200, z), (280, 200, z), (280, 280, z)], pulse={"anim": "sm-a", "color": ACC_T}, color=ACC_T)
    stack = [("choice", "category · 3 options", 0), ("yes / no", "urgent · confidence", -58), ("score", "priority · 1–5", -116)]
    anims = ["sm-b", "sm-c", "sm-d"]
    for i in range(len(stack) - 1):
        a, b = s.P(280, 320, stack[i][2]), s.P(280, 320, stack[i + 1][2] + 8)
        s.screen_wire([a, b], pulse={"anim": anims[i], "color": ACC_T}, color=ACC_T)
    a, b = s.P(280, 320, stack[-1][2]), s.P(280, 320, -150)
    s.screen_wire([a, b], pulse={"anim": anims[-1], "color": ACC_T}, color=ACC_T)

    s.box(0, 0, 0, W, D, 12, "#26272B", "#232427", "#1C1D20", stroke="rgba(236,237,239,0.22)")
    for r, row in enumerate(grid):
        for c, (name, found) in enumerate(row):
            x, y = PAD + c * (T + G), PAD + r * (T + G)
            if found:
                cls = _found_class((r * 3 + c) / 11)
                s.box(x, y, 12, T, T, 4, TILE, "#2A2B2F", "#222326", extra_top=f' class="{cls}"')
                s.text_x(x + 5, y + T - 8, 16, name, size=8, fill=TXT)
            else:
                s.rect_top(x, y, 12, T, T, "none", stroke="rgba(236,237,239,0.2)", dash="3 4")
                s.text_x(x + 5, y + T - 8, 12, name, size=8, fill="#6C6F77")
    s.dot(W, 200, z, r=3)

    for title, sub, zz in stack:
        s.box(220, 280, zz, 120, 80, 8, SLAB, "#0D0D0F", "#0B0B0C", stroke="rgba(243,134,161,0.45)")
        s.text_x(230, 336, zz + 8, title, size=12, fill=ACC_T, weight=500)
        s.text_x(230, 350, zz + 8, sub, size=9.5, fill=LABEL)
    s.box(252, 292, -206, 56, 56, 56, ACC, ACC_L, ACC_D, stroke="rgba(243,134,161,0.7)")
    s.text_x(263, 328, -150, "jev", size=14, fill="#1E1E1E", weight=600)

    s.text_negy(-16, D - 4, 0, "// your codebase", size=12, fill=TXT)
    s.text_negy(352, 350, 0, "// decisions found", size=11)
    s.text_x(252, 364, -206, "// typed answers on jev", size=11, fill=ACC_T)

    top = s.P(30, 150, 150)
    s.screen_wire([top, s.P(30, 150, 12)], pulse={"anim": "sm-panel", "color": ACC_T})
    s.dot(30, 150, 150, r=3)
    w, h = 300, 96
    px, py = top[0] - 90, top[1] - h
    s.pts += [(px, py), (px + w, py + h)]
    s.add(f'<rect x="{s.f(px)}" y="{s.f(py)}" width="{w}" height="{h}" rx="3" fill="#111113" stroke="rgba(236,237,239,0.14)"></rect>')
    lines = [[("$ ", "#7C7F87"), ("jev-swap scan ./app", TXT)], [("Found 5 candidate(s)", "#7C7F87")],
             [("triage.ts:15  ", ACC_T), ("category urgent", TXT)], [("spam.py:8     ", ACC_T), ("yes/no", TXT)]]
    for i, line in enumerate(lines):
        spans = "".join(f'<tspan fill="{c}">{esc(t)}</tspan>' for t, c in line)
        s.add(f'<text x="{s.f(px + 14)}" y="{s.f(py + 24 + i * 19)}" font-family="{MONO}" font-size="12" style="white-space: pre;">{spans}</text>')

    dx, dy = (W + 8) * C_, (W + 8) * S_
    KEYFRAMES.append(f"@keyframes beamm{{0%,7%{{transform:translate(0px,0px);opacity:0}}8%{{opacity:1}}46%{{transform:translate({dx:.1f}px,{dy:.1f}px);opacity:1}}48%,100%{{transform:translate({dx:.1f}px,{dy:.1f}px);opacity:0}}}}")
    KEYFRAMES.append(".beam-m{animation:beamm 6s linear infinite}")
    s.add('<g class="beam-m">')
    s.rect_top(-4, -10, 24, 10, D + 20, "rgba(243,134,161,0.22)", stroke="#F386A1")
    s.add("</g>")
    return s.svg(pad=16, label="jev-swap scans your codebase, lights up the LLM calls that are really decisions, and sorts them into choice, yes/no and score questions for Jev.", cls="iso hero-iso")
