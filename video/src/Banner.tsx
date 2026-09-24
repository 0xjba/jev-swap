import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/InterTight";
import { loadFont as loadPixel } from "@remotion/google-fonts/VT323";
import { C, MONO } from "./theme";
import { Mark } from "./ui";

// TypeSafe's site look (typesafe.ai): pink dotted-grid field, 1-bit dithered blobs, crop marks, a large tight
// grotesk, dotted leaders and retro OS dialogs. Die Grotesk and LisaTerminal are commercial, so the free
// Inter Tight and VT323 stand in for them.
const GROTESK = loadGrotesk("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
const PIXEL = loadPixel("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

const INK = "#1E1E1E";
const PINK = "#F386A1";
const GREY = "#DEDEDE";
const W = 1280;
const H = 640;
const PAD = 32;

/** Deterministic PRNG so the dither is the same on every render. */
const rand = (() => {
  let s = 20260924;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
})();

/** Ordered (Bayer 4x4) 1-bit dither of lit spheres, like the halftone blobs on typesafe.ai. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const DITHER = (() => {
  const blobs = [
    { x: 175, y: 560, r: 230 },
    { x: 1135, y: 110, r: 200 },
  ];
  const cell = 3;
  const out: [number, number][] = [];
  for (let y = PAD; y < H - PAD; y += cell) {
    for (let x = PAD; x < W - PAD; x += cell) {
      let v = 0;
      for (const b of blobs) {
        const d = Math.hypot(x - b.x, y - b.y) / b.r;
        if (d >= 1) continue;
        // Sphere shading lit from the top left, darkest at the lower-right rim, soft falloff at the edge.
        const z = Math.sqrt(1 - d * d);
        const lit = ((x - b.x) / b.r) * 0.45 + ((y - b.y) / b.r) * 0.45 + (1 - z) * 0.5;
        v = Math.max(v, Math.min(1, 0.25 + lit) * Math.min(1, (1 - d) * 3.2));
      }
      const t = BAYER[(Math.round((y - PAD) / cell) % 4) * 4 + (Math.round((x - PAD) / cell) % 4)];
      if (v > t) out.push([x, y]);
    }
  }
  return out;
})();

const VERTICAL = Array.from({ length: 64 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)]).join("");

const Crop: React.FC<{ x: number; y: number; dx: number; dy: number }> = ({ x, y, dx, dy }) => (
  <path d={`M${x + dx * 12} ${y}H${x}V${y + dy * 12}`} fill="none" stroke={INK} strokeWidth={1.2} />
);

export const Banner: React.FC = () => (
  <AbsoluteFill style={{ background: PINK }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        {/* The dotted grid of TypeSafe's pink panels: small pairs of ink dots on a 12 px lattice. */}
        <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse" x={PAD} y={PAD}>
          <rect x="2" y="2" width="1.6" height="1.6" fill={INK} opacity="0.3" />
          <rect x="2" y="6" width="1.6" height="1.6" fill={INK} opacity="0.3" />
        </pattern>
      </defs>
      <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="url(#grid)" />
      <g fill={INK}>
        {DITHER.map(([x, y], i) => <rect key={i} x={x} y={y} width={2} height={2} />)}
      </g>
      <Crop x={PAD - 12} y={PAD - 12} dx={1} dy={1} />
      <Crop x={W - PAD + 12} y={PAD - 12} dx={-1} dy={1} />
      <Crop x={PAD - 12} y={H - PAD + 12} dx={1} dy={-1} />
      <Crop x={W - PAD + 12} y={H - PAD + 12} dx={-1} dy={-1} />

      <text transform={`translate(${W - PAD - 12} ${PAD + 64}) rotate(90)`} fontFamily={MONO} fontSize={9} letterSpacing={1.4} fill={INK} opacity={0.55}>
        {VERTICAL}
      </text>

      {/* Dotted leader above the headline. */}
      <text x={W / 2} y={152} textAnchor="middle" fontFamily={GROTESK} fontSize={19} letterSpacing={0.9} fill={INK}>
        Introducing jev-swap <tspan letterSpacing={2.6}>.........................</tspan> for TypeSafe Jev
      </text>

      <text x={W / 2} y={336} textAnchor="middle" fontFamily={GROTESK} fontWeight={500} fontSize={196} letterSpacing={-9} fill={INK}>
        jev-swap
      </text>

      {/* Retro dialog: black title bar, grey body, hard offset shadow. */}
      <g transform="translate(418 404)">
        <rect x={6} y={6} width={444} height={146} fill={INK} opacity={0.85} />
        <rect x={0} y={0} width={444} height={146} fill={GREY} stroke={INK} strokeWidth={1.5} />
        <rect x={0} y={0} width={444} height={28} fill={INK} />
        <text x={10} y={20} fontFamily={PIXEL} fontSize={21} fill={GREY}>jev-swap</text>
        <rect x={16} y={44} width={86} height={86} fill="#FEFEFE" stroke={INK} strokeWidth={1.5} />
        <Mark x={59} y={87} size={74} ink={INK} />
        <text fontFamily={PIXEL} fontSize={30} fill={INK}>
          <tspan x={124} y={70}>Find the decisions.</tspan>
          <tspan x={124} y={98}>Swap them to Jev.</tspan>
          <tspan x={124} y={126}>Prove it.</tspan>
        </text>
      </g>
    </svg>
  </AbsoluteFill>
);
