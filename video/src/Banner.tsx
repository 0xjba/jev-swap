import React from "react";
import { AbsoluteFill } from "remotion";
import { C, MONO, SANS } from "./theme";
import { HalftoneMark } from "./HalftoneMark";

// jev-swap's own site theme (dark, TypeSafe pinks, DM Sans + JetBrains Mono, framed grid), borrowing only generic
// devices: an ordered halftone dither, crop marks and a dotted leader.
const W = 1280;
const H = 640;
const IN = 48; // frame inset
const SPLIT = 744; // column divider

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** The logo's switch, drawn big as a 1-bit halftone: a dim track and a lit pink knob in the "on" position. */
const SWITCH = (() => {
  const cx = 994, cy = 318, w = 384, h = 184, r = h / 2;
  const knob = { x: cx + w / 2 - r, y: cy, r: 62 }; // same knob-to-track ratio as the logo
  const cell = 4;
  const dots: { x: number; y: number; c: string }[] = [];
  for (let gy = 0, y = IN + 2; y < H - IN; y += cell, gy++) {
    for (let gx = 0, x = SPLIT + 2; x < W - IN; x += cell, gx++) {
      const th = BAYER[(gy % 4) * 4 + (gx % 4)];
      // Knob: a sphere lit from the upper left.
      const kd = Math.hypot(x - knob.x, y - knob.y) / knob.r;
      if (kd < 1) {
        const z = Math.sqrt(1 - kd * kd);
        const light = 0.45 + 0.55 * Math.max(0, (-(x - knob.x) / knob.r) * 0.45 - ((y - knob.y) / knob.r) * 0.45 + z * 0.75);
        if (Math.min(1, light) > th) dots.push({ x, y, c: light > 0.85 ? C.pinkPale : C.pink });
        continue;
      }
      const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0);
      const ring = Math.hypot(dx, y - cy) - r;
      if (Math.abs(ring) < 3.2) {
        dots.push({ x, y, c: C.text });
        continue;
      }
      const inPill = ring < -8;
      if (!inPill) continue;
      // Glow around the knob, kept inside the track.
      if (kd < 1.6 && (1.6 - kd) * 0.4 > th) {
        dots.push({ x, y, c: C.pink2 });
        continue;
      }
      // Track: a faint fill that deepens toward the knob.
      if (0.08 + 0.2 * ((x - (cx - w / 2)) / w) > th) dots.push({ x, y, c: C.mid });
    }
  }
  return { dots, cx, cy, w, h, r };
})();

/** Small crop mark at a frame corner. */
const Crop: React.FC<{ x: number; y: number; dx: number; dy: number; color?: string }> = ({ x, y, dx, dy, color = C.dim }) => (
  <path d={`M${x + dx * 14} ${y}H${x}V${y + dy * 14}`} fill="none" stroke={color} strokeWidth={1.5} />
);

export const Banner: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* The site's framed grid: hairline frame and a column divider, with crop marks at the corners. */}
      <rect x={IN} y={IN} width={W - 2 * IN} height={H - 2 * IN} fill={C.panel} stroke={C.line} strokeWidth={1} />
      <line x1={SPLIT} x2={SPLIT} y1={IN} y2={H - IN} stroke={C.line} strokeWidth={1} />
      <Crop x={IN - 10} y={IN - 10} dx={1} dy={1} color={C.pink} />
      <Crop x={W - IN + 10} y={IN - 10} dx={-1} dy={1} />
      <Crop x={IN - 10} y={H - IN + 10} dx={1} dy={-1} />
      <Crop x={W - IN + 10} y={H - IN + 10} dx={-1} dy={-1} />

      {/* Left column: lockup and line. */}
      <text x={96} y={124} fontFamily={MONO} fontSize={17} letterSpacing={0.7} fill={C.pink}>
        {"// open source"}
        <tspan fill={C.mid}> ...................... </tspan>
        <tspan fill={C.muted}>for TypeSafe Jev</tspan>
      </text>
      <HalftoneMark x={146} y={236} size={124} pitch={3.4} />
      <text x={200} y={264} fontFamily={MONO} fontWeight={600} fontSize={76} letterSpacing={-2.5} fill={C.text}>
        jev<tspan fill={C.muted} fontWeight={500}>-swap</tspan>
      </text>
      {/* The workflow, in order: the last step is the payoff. */}
      {["Find the decisions", "Run the shadow proxy", "Estimate the savings", "See the difference", "Swap to Jev"].map((step, i, all) => (
        <g key={step}>
          <text x={96} y={392 + i * 42} fontFamily={MONO} fontSize={16} fill={i === all.length - 1 ? C.pink : C.dim}>
            {String(i + 1).padStart(2, "0")}
          </text>
          <text x={136} y={392 + i * 42} fontFamily={SANS} fontWeight={500} fontSize={30} letterSpacing={-0.8} fill={i === all.length - 1 ? C.pink : C.text}>
            {step}
          </text>
        </g>
      ))}

      {/* Right column: the switch in halftone. */}
      <g>
        {SWITCH.dots.map((d, i) => <rect key={i} x={d.x} y={d.y} width={2.4} height={2.4} fill={d.c} />)}
      </g>
      <text x={SWITCH.cx - SWITCH.w / 2} y={SWITCH.cy + SWITCH.h / 2 + 64} fontFamily={MONO} fontSize={15} letterSpacing={0.6} fill={C.muted}>
        <tspan fill={C.dim}>llm</tspan>
        <tspan fill={C.mid}> ................................ </tspan>
        <tspan fill={C.pink}>jev</tspan>
      </text>
    </svg>
  </AbsoluteFill>
);
