// Shared helpers for the site's isometric figures. They are drawn with the Anatomy kit
// (kit/iso-kit.mjs, MIT, see kit/LICENSE-anatomy) following its rules: one real machine per idea,
// solids painted back to front, one lit part, and a readout that comes from the model that moves the parts.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

export { k };
export const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, "out");

/** Drawing shorthands bound to one projection. */
export function tools(P) {
  const at = (point) => k.iso(point, P);
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  return {
    at,
    byDepth,
    S: (paths, style) => k.solidSvg(paths, style),
    L: (d, style) => k.lineSvg(d, style),
    D: (points, style) => k.dotsSvg(points, style),
    halo: (plan, z, h, blur) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"${blur ? ` style="filter:blur(${blur}px)"` : ""}/>`,
    /** Screen vectors of one world unit along x, y and z, for the live code to move pre-built groups. */
    axes: { x: k.axisVector(P, [1, 0, 0]), y: k.axisVector(P, [0, 1, 0]), z: k.axisVector(P, [0, 0, 1]) },
  };
}

/** A base plate on four feet with a groove and corner screws (craft.md, "Base plate on feet"). */
export function basePlate(PLATE, H, FOOT, P) {
  const { S, L, D, at, byDepth, halo } = tools(P);
  const out = [halo(PLATE, -H - FOOT, H)];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -H - FOOT, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -H - FOOT + 1.6, FOOT - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -H, H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

/** A ruler strip lying on a top face, ticks hanging from its far edge, a screw dot at each end. */
export function rulerStrip(strip, z, P, { step = 4, every = 5 } = {}) {
  const { S, L, D, at } = tools(P);
  const out = [S(k.slabOf(strip, z, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, step, every, strip.y + 0.8, z + 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + strip.d / 2, z + 0.6]), at([strip.x + strip.w - 2, strip.y + strip.d / 2, z + 0.6])], { size: 0.45 }));
  return out.join("");
}

/** A small label plate with three rule lines that stand for engraved text. */
export function labelPlate(plate, z, P) {
  const { S, L, D, at } = tools(P);
  const out = [S(k.slabOf(plate, z, 0.6, P, 3), { tone: "lo", crease: "none" })];
  for (const [row, share] of [[0.3, 0.8], [0.52, 0.6], [0.74, 0.7]]) {
    const y = plate.y + plate.d * row;
    out.push(L(k.lineOnTop([plate.x + 5, y], [plate.x + 5 + (plate.w - 10) * share, y], z + 0.6, P), { tone: "lo", free: true }));
  }
  out.push(D([at([plate.x + 2.2, plate.y + plate.d / 2, z + 0.6]), at([plate.x + plate.w - 2.2, plate.y + plate.d / 2, z + 0.6])], { size: 0.4 }));
  return out.join("");
}

/**
 * Writes one figure: `out/<name>.html` (the card markup the site embeds), `out/<name>.js` (its live code,
 * an IIFE scoped to its own root) and `out/<name>-preview.html` (a standalone page for the visual checks).
 */
export function writeFigure(name, { title, fig, hint, readout, keys, caption, stage, live }) {
  mkdirSync(OUT, { recursive: true });
  const card = k.plateHtml({ fig, title, hint, readout, keys, caption, body: stage });
  const html = `<div class="iso fig-${name}" data-figure="${name}">${card}</div>`;
  const js = `(function(){var root=document.querySelector('[data-figure="${name}"]');if(!root)return;${live}})();`;
  writeFileSync(join(OUT, `${name}.html`), html);
  writeFileSync(join(OUT, `${name}.js`), js);
  writeFileSync(join(OUT, "iso.css"), k.ISO_CSS + SITE_CSS);
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>${k.ISO_CSS}${SITE_CSS}body{margin:0;background:#19191B;font:14px/1.6 ui-sans-serif,system-ui,sans-serif}.wrap{width:min(720px,100% - 24px);margin:40px auto}</style></head>
<body><div class="wrap">${html}</div><script>${js.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
  writeFileSync(join(OUT, `${name}-preview.html`), page);
  console.log(`wrote out/${name}.html (${(html.length / 1024).toFixed(0)} KB), out/${name}.js (${(js.length / 1024).toFixed(1)} KB)`);
}

/** The site's theme for the kit's tokens: its dark panel as paper, TypeSafe pink as the one accent. */
export const SITE_CSS = `
.iso{--anatomy-card:#111113;--anatomy-paper:#111113;--anatomy-face:#2A1A20;--anatomy-top:#202024;
  --anatomy-shade-0:#0C0C0E;--anatomy-shade-1:#111113;--anatomy-shade-2:#161619;--anatomy-shade-3:#1B1B1E;
  --anatomy-lit:#F386A1;--anatomy-lit-top:#F386A1;--anatomy-lit-shade:#B8506F;
  --anatomy-hi:#D8D9DE;--anatomy-mid:#7A7D85;--anatomy-lo:#4A4B52;--anatomy-faint:#2F3035;
  --anatomy-text:#A1A3A9;--anatomy-strong:#ECEDEF;--anatomy-muted:#6C6F77;--anatomy-dot:#ECEDEF;
  --anatomy-mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
.iso .iso-figure{margin:0}
.iso .iso-plate{box-shadow:0 0 0 1px #2B2C30;border-radius:4px}
.iso .iso-stage{outline:none;touch-action:pan-y;cursor:ew-resize}
.iso .iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.iso .iso-legend{font-family:"DM Sans",ui-sans-serif,system-ui,sans-serif;font-size:14px;color:#8E9199}
.iso .iso-caption{color:#8E9199}
.iso .iso-plate-corner[data-corner="readout"]{color:#FCD9E3;line-height:1.4;bottom:-3px}
.iso [hidden]{display:none}
@media (max-width:560px){.iso .iso-plate-corner[data-corner="readout"]{max-width:none;left:0;right:auto;bottom:0}.iso .iso-plate-corner[data-corner="hint"]{bottom:18px}}
`;
