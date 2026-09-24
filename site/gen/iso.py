"""Isometric SVG helpers for the jev-swap landing page illustrations."""
import math

C, S = math.cos(math.radians(30)), 0.5

LINE = "#8E9199"
EDGE = "rgba(236,237,239,0.22)"
LABEL = "#8E9199"
MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace"


# anim name -> (cycle seconds, [(start%, end%), ...])
TIMING = {
    "run-a": (7, [(0, 14)]), "run-b": (7, [(14, 22)]), "run-c": (7, [(22, 34)]),
    "run-d": (7, [(14, 60)]), "run-e": (7, [(60, 86)]),
    "m-a": (7, [(0, 12)]), "m-b": (7, [(12, 20)]), "m-c": (7, [(20, 28)]),
    "m-d": (7, [(12, 52)]), "m-e": (7, [(52, 64)]), "m-f": (7, [(64, 76)]),
    "g-in": (8, [(0, 18), (50, 68)]), "g-jev": (8, [(18, 36)]), "g-llm": (8, [(68, 90)]),
    "i-conv": (3, [(10, 60)]), "i-shadow": (3, [(10, 60)]),
    "s-panel": (6, [(0, 10)]), "s-out": (6, [(50, 60)]), "s-jev": (6, [(62, 74)]),
    "sm-panel": (6, [(0, 10)]), "sm-a": (6, [(48, 56)]), "sm-b": (6, [(56, 64)]), "sm-c": (6, [(64, 72)]), "sm-d": (6, [(72, 80)]),
}
KEYFRAMES = []
_n = [0]


def add_pulse(anim, length):
    """One class + @keyframes per moving dot, with its path length baked in (no CSS variables)."""
    _n[0] += 1
    name = f"pk{_n[0]}"
    dur, windows = TIMING[anim]
    L = round(length, 1)
    gap = round(length + 40, 1)
    frames = ["0%{stroke-dashoffset:0px;opacity:0}"]
    for a, b in windows:
        if a == 0:
            frames[0] = "0%{stroke-dashoffset:0px;opacity:1}"
        else:
            frames.append(f"{a}%{{stroke-dashoffset:0px;opacity:0}}")
            frames.append(f"{a + 0.01:g}%{{stroke-dashoffset:0px;opacity:1}}")
        frames.append(f"{b}%{{stroke-dashoffset:-{L}px;opacity:1}}")
        frames.append(f"{b + 0.01:g}%{{stroke-dashoffset:-{L}px;opacity:0}}")
    frames.append(f"100%{{stroke-dashoffset:-{L}px;opacity:0}}")
    KEYFRAMES.append(f"@keyframes {name}{{{''.join(frames)}}}")
    KEYFRAMES.append(f".{name}{{stroke-dasharray:0.01px {gap}px;animation:{name} {dur}s linear infinite}}")
    return name


class Scene:
    def __init__(self, ox=0.0, oy=0.0):
        self.ox, self.oy = ox, oy
        self.parts = []
        self.pts = []

    def P(self, x, y, z=0.0):
        p = (self.ox + (x - y) * C, self.oy + (x + y) * S - z)
        self.pts.append(p)
        return p

    @staticmethod
    def f(v):
        return f"{v:.1f}".rstrip("0").rstrip(".")

    def pts_attr(self, ps):
        return " ".join(f"{self.f(x)},{self.f(y)}" for x, y in ps)

    def add(self, s):
        self.parts.append(s)

    # ---------- primitives ----------

    def poly(self, ps, fill, stroke=EDGE, sw=1, extra=""):
        self.add(f'<polygon points="{self.pts_attr(ps)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{extra}></polygon>')

    def box(self, x, y, z, w, d, h, top, left, right, stroke=EDGE, extra_top=""):
        """Visible faces: x=max (right), y=max (left), top."""
        P = self.P
        self.poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], right, stroke)
        self.poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], left, stroke)
        self.poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top, stroke, extra=extra_top)

    def rect_top(self, x, y, z, w, d, fill, stroke=EDGE, dash=None, extra=""):
        P = self.P
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.poly([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], fill, stroke, extra=da + extra)

    @staticmethod
    def _chars(s):
        import re as _re
        return len(_re.sub(r"&[a-z#0-9]+;", "x", s))

    def text_x(self, x, y, z, s, size=9, fill=LABEL, anchor="start", weight=400, extra=""):
        """Text lying on the ground plane, reading along +x."""
        px, py = self.P(x, y, z)
        L = self._chars(s) * size * 0.62  # monospace advance, so the viewBox includes the whole label
        self.pts.append((px + C * L, py + S * L))
        self.add(f'<text transform="matrix({C:.4f} {S} {-C:.4f} {S} {self.f(px)} {self.f(py)})" font-family="{MONO}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{extra}>{s}</text>')

    def text_negy(self, x, y, z, s, size=9, fill=LABEL, anchor="start", weight=400, extra=""):
        """Text lying on the ground plane, reading along -y (up and to the right)."""
        px, py = self.P(x, y, z)
        L = self._chars(s) * size * 0.62
        self.pts.append((px + C * L, py - S * L))
        self.add(f'<text transform="matrix({C:.4f} {-S} {C:.4f} {S} {self.f(px)} {self.f(py)})" font-family="{MONO}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{extra}>{s}</text>')

    def text_flat(self, px, py, s, size=11, fill=LABEL, anchor="start", weight=400, family=MONO, extra=""):
        L = self._chars(s) * size * 0.62
        self.pts += [(px, py), (px - L if anchor == "end" else px + L, py)]
        self.add(f'<text x="{self.f(px)}" y="{self.f(py)}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{extra}>{s}</text>')

    # ---------- wires ----------

    def wire(self, iso_pts, dashed=False, pulse=None, color=LINE, opacity=0.8):
        """iso_pts: list of (x,y,z). pulse: dict(anim=name, color=, glow=) adds a moving dot."""
        ps = [self.P(*p) for p in iso_pts]
        d = "M" + " L".join(f"{self.f(x)} {self.f(y)}" for x, y in ps)
        length = sum(math.dist(ps[i], ps[i + 1]) for i in range(len(ps) - 1))
        da = ' stroke-dasharray="4 5"' if dashed else ""
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-opacity="{opacity}" stroke-width="1.2"{da}></path>')
        if pulse:
            self.pulse_path(d, length, pulse)
        return d, length

    def screen_wire(self, ps, dashed=False, pulse=None, color=LINE, opacity=0.8):
        for p in ps:
            self.pts.append(p)
        d = "M" + " L".join(f"{self.f(x)} {self.f(y)}" for x, y in ps)
        length = sum(math.dist(ps[i], ps[i + 1]) for i in range(len(ps) - 1))
        da = ' stroke-dasharray="4 5"' if dashed else ""
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-opacity="{opacity}" stroke-width="1.2"{da}></path>')
        if pulse:
            self.pulse_path(d, length, pulse)
        return d, length

    def pulse_path(self, d, length, pulse):
        cls = add_pulse(pulse["anim"], length)
        color = pulse.get("color", "#FFFFFF")
        self.add(f'<path class="pulse {cls}" d="{d}" fill="none" stroke="{color}" stroke-width="{pulse.get("w", 6)}" stroke-linecap="round"></path>')

    def dot(self, x, y, z, r=3, fill="#FFFFFF"):
        px, py = self.P(x, y, z)
        self.add(f'<circle cx="{self.f(px)}" cy="{self.f(py)}" r="{r}" fill="{fill}"></circle>')

    def group(self, cls, body_fn):
        self.add(f'<g class="{cls}">')
        body_fn()
        self.add("</g>")

    def svg(self, pad=24, label="", cls=""):
        xs = [p[0] for p in self.pts]
        ys = [p[1] for p in self.pts]
        x0, y0 = min(xs) - pad, min(ys) - pad
        w, h = max(xs) - x0 + pad, max(ys) - y0 + pad
        return (
            f'<svg class="{cls}" viewBox="{self.f(x0)} {self.f(y0)} {self.f(w)} {self.f(h)}" role="img" aria-label="{label}" '
            f'style="display: block; width: 100%; height: auto;" xmlns="http://www.w3.org/2000/svg">'
            + "".join(self.parts)
            + "</svg>"
        ), (w, h)
