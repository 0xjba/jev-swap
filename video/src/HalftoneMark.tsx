import React from "react";
import { interpolate } from "remotion";
import { C } from "./theme";

// The jev-swap mark drawn entirely on an ordered-dither (Bayer 4x4) dot grid: dot-matrix ring and hook, a grey
// dotted track and a lit pink knob. For large placements only (about 64 px and up); below that the dots turn to
// noise and the solid mark (ui.tsx Mark) is used.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const RING_W = 1.2; // ring stroke width (logo units; the solid mark uses 2.2)
const HOOK_W = 1.6;
const KNOB_R = 3.1;

/** Hook path M17 15.5 V23.5 Q17 29 11.5 29 H9, as line segments. */
const HOOK: [number, number][] = (() => {
  const pts: [number, number][] = [[17, 15.5], [17, 23.5]];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    pts.push([(1 - t) ** 2 * 17 + 2 * (1 - t) * t * 17 + t * t * 11.5, (1 - t) ** 2 * 23.5 + 2 * (1 - t) * t * 29 + t * t * 29]);
  }
  pts.push([9, 29]);
  return pts;
})();

const segDist = (x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
/** Signed distance to the ring's centre line (a pill from x 7.5..25.5, y 3..12). */
const pill = (x: number, y: number) => Math.hypot(Math.max(Math.abs(x - 16.5) - 4.5, 0), y - 7.5) - 4.5;

const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)).join(",")})`;
};

type Dot = { x: number; y: number; c: string; s: number };

/** Dots for a mark `size` px wide. knob: 0 = off (grey, left) .. 1 = on (pink, right). reveal: 0..1 ordered dissolve-in. */
export function halftoneDots(size: number, knob = 1, reveal = 1, pitchPx?: number): Dot[] {
  const cell = (pitchPx ?? Math.max(2.6, size / 56)) / (size / 32); // dot pitch in logo units
  const kx = 7.5 + 0.6 + KNOB_R + 0.5 + (18 - 2 * (0.6 + KNOB_R + 0.5)) * knob;
  const knobLo = mixHex(C.dim, C.pink, knob), knobHi = mixHex(C.soft, C.pinkPale, knob), glow = mixHex(C.mid, C.pink2, knob);
  const dots: Dot[] = [];
  for (let gy = 0, y = cell / 2; y < 32; y += cell, gy++) {
    for (let gx = 0, x = cell / 2; x < 32; x += cell, gx++) {
      const th = BAYER[(gy % 4) * 4 + (gx % 4)];
      if (reveal < 1 && th * 0.55 + (y / 32) * 0.45 > reveal) continue;
      const d = pill(x, y);
      if (Math.abs(d) < RING_W / 2 || HOOK.some((p, i) => i > 0 && segDist(x, y, HOOK[i - 1], p) < HOOK_W / 2)) {
        dots.push({ x, y, c: C.text, s: 0.74 });
        continue;
      }
      if (d > -RING_W / 2 - cell * 0.4) continue; // outside the track
      const kd = Math.hypot(x - kx, y - 7.5) / KNOB_R;
      if (kd < 1) {
        const z = Math.sqrt(1 - kd * kd);
        const light = 0.5 + 0.5 * Math.max(0, (-(x - kx) / KNOB_R) * 0.45 - ((y - 7.5) / KNOB_R) * 0.45 + z * 0.75);
        if (Math.min(1, light) > th) dots.push({ x, y, c: light > 0.88 ? knobHi : knobLo, s: 0.74 });
      } else if (kd < 1.55 && (1.55 - kd) * 0.55 * knob > th) {
        dots.push({ x, y, c: glow, s: 0.66 });
      } else if (0.1 + 0.2 * ((x - 7.5) / 18) > th) {
        dots.push({ x, y, c: C.mid, s: 0.56 });
      }
    }
  }
  const pitch = cell;
  return dots.map((d) => ({ ...d, s: d.s * pitch }));
}

/** SVG group drawing the halftone mark centred on (x, y) at `size` px. */
/** `pitch` sets the dot spacing in px (default scales with size); use a coarser pitch where the image is shown downscaled. */
export const HalftoneMark: React.FC<{ x: number; y: number; size: number; knob?: number; reveal?: number; pitch?: number }> = ({ x, y, size, knob = 1, reveal = 1, pitch }) => {
  const k = size / 32;
  const dots = halftoneDots(size, knob, interpolate(reveal, [0, 1], [0, 1.02]), pitch);
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`}>
      {dots.map((d, i) => <rect key={i} x={d.x - d.s / 2} y={d.y - d.s / 2} width={d.s} height={d.s} fill={d.c} />)}
    </g>
  );
};
