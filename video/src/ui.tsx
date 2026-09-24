import React from "react";
import { AbsoluteFill, Easing, interpolate, spring } from "remotion";
import { C, FPS, H, MONO, SANS, W } from "./theme";

export const ease = Easing.bezier(0.3, 0.7, 0.25, 1);

/** Clamped, eased interpolation of frame f over [a, b]. */
export const t = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** A springy 0 -> 1 pop starting at `start`. */
export const pop = (f: number, start: number) =>
  f < start ? 0 : spring({ frame: f - start, fps: FPS, config: { damping: 13, stiffness: 170, mass: 0.6 } });

/** Scale an element about its own centre. */
export const About: React.FC<{ x: number; y: number; s: number; o?: number; children: React.ReactNode }> = ({ x, y, s, o = 1, children }) => (
  <g transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`} opacity={o}>
    {children}
  </g>
);

/** Scene wrapper: the camera eases in on entry and pulls back on exit, like the reference's zoom cuts. */
export const Cam: React.FC<{ f: number; dur: number; children: React.ReactNode }> = ({ f, dur, children }) => {
  const s = t(f, 0, 22, 1.07, 1) * t(f, dur - 18, dur, 1, 0.95);
  const o = Math.min(t(f, 0, 14), 1 - t(f, dur - 14, dur));
  return (
    <AbsoluteFill style={{ transform: `scale(${s})`, opacity: o }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {children}
      </svg>
    </AbsoluteFill>
  );
};

/** Faint dot grid that drifts slowly behind every scene. */
export const Backdrop: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={W} height={H}>
      <defs>
        <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`translate(${(-f * 0.25) % 40} 0)`}>
          <circle cx="2" cy="2" r="1.2" fill="#26272B" />
        </pattern>
        <radialGradient id="vig" cx="50%" cy="45%" r="70%">
          <stop offset="60%" stopColor={C.bg} stopOpacity="0" />
          <stop offset="100%" stopColor="#0C0C0D" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#dots)" />
      <rect width={W} height={H} fill="url(#vig)" />
    </svg>
  </AbsoluteFill>
);

/** The jev-swap mark: a j whose dot is a switch. `draw` strokes it in, `knob` slides the switch on (0 -> 1). */
export const Mark: React.FC<{ x: number; y: number; size: number; draw?: number; knob?: number }> = ({ x, y, size, draw = 1, knob = 1 }) => {
  const k = size / 32;
  const knobColor = interpolate(knob, [0, 0.6, 1], [0, 0, 1]) > 0.5 ? C.pink : C.dim;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`}>
      <rect x="7.5" y="3" width="18" height="9" rx="4.5" fill="none" stroke={C.text} strokeWidth="2.2"
        pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
      <path d="M17 15.5V23.5Q17 29 11.5 29H9" fill="none" stroke={C.text} strokeWidth="2.8" strokeLinecap="round"
        pathLength={1} strokeDasharray="1" strokeDashoffset={1 - t(draw, 0.3, 1)} />
      <circle cx={12 + 9 * knob} cy="7.5" r="2.9" fill={knobColor} opacity={t(draw, 0.6, 1)} />
    </g>
  );
};

/** A panel with a title bar, like a file or terminal window. */
export const Win: React.FC<{
  x: number; y: number; w: number; h: number; title?: string; accent?: boolean; o?: number; s?: number; children?: React.ReactNode;
}> = ({ x, y, w, h, title, accent, o = 1, s = 1, children }) => (
  <About x={x + w / 2} y={y + h / 2} s={s} o={o}>
    <rect x={x} y={y} width={w} height={h} rx={8} fill={C.panel} stroke={accent ? C.pink : C.line2} strokeWidth={1.5} />
    {title !== undefined && (
      <>
        <line x1={x} x2={x + w} y1={y + 44} y2={y + 44} stroke={C.line} strokeWidth={1.5} />
        {[0, 1, 2].map((i) => <circle key={i} cx={x + 22 + i * 16} cy={y + 22} r={4.5} fill={C.line2} />)}
        <text x={x + w - 20} y={y + 28} textAnchor="end" fontFamily={MONO} fontSize={16} fill={C.muted}>{title}</text>
      </>
    )}
    {children}
  </About>
);

/** Abstract code lines that type in (width grows) between `start` and `start + dur`. */
export const Lines: React.FC<{
  f: number; x: number; y: number; widths: number[]; indents?: number[]; start: number; dur?: number; gap?: number; hl?: number; hlAt?: number; dimAt?: number;
}> = ({ f, x, y, widths, indents = [], start, dur = 30, gap = 34, hl = -1, hlAt = 1e9, dimAt = 1e9 }) => (
  <g opacity={1 - 0.55 * t(f, dimAt, dimAt + 12)}>
    {widths.map((w, i) => {
      const p = t(f, start + (i * dur) / widths.length, start + ((i + 1) * dur) / widths.length);
      const on = i === hl ? t(f, hlAt, hlAt + 10) : 0;
      const ix = x + (indents[i] ?? 0) * 28;
      return (
        <g key={i}>
          {on > 0 && <rect x={ix - 10} y={y + i * gap - 13} width={(w + 20) * on} height={26} rx={4} fill={C.pink} opacity={0.16} />}
          <rect x={ix} y={y + i * gap - 4} width={w * p} height={8} rx={4} fill={on > 0.5 ? C.pink : i % 3 === 0 ? C.mid : C.line2} />
        </g>
      );
    })}
  </g>
);

/** An arrow that draws in, then text flows along it (the reference's data stream, with our own content). */
export const Stream: React.FC<{
  f: number; id: string; x1: number; x2: number; y: number; start: number; dur?: number; text: string; color?: string; hold?: boolean;
}> = ({ f, id, x1, x2, y, start, dur = 45, text, color = C.pink, hold }) => {
  const dir = x2 > x1 ? 1 : -1;
  const len = Math.abs(x2 - x1);
  const draw = t(f, start, start + 12);
  const p = interpolate(f, [start + 8, start + 8 + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tw = text.length * 10.8;
  const head = dir > 0 ? x1 + len * draw : x1 - len * draw;
  const tx = dir > 0 ? x1 - tw + (len + tw) * p : x1 + tw - (len + tw) * p;
  const lo = Math.min(x1, x2);
  const active = f > start + 8 && (hold || p < 1);
  return (
    <g>
      <defs>
        <clipPath id={`clip-${id}`}><rect x={lo} y={y - 40} width={len} height={34} /></clipPath>
      </defs>
      <line x1={x1} x2={head} y1={y} y2={y} stroke={C.mid} strokeWidth={2} />
      {draw > 0.95 && <path d={dir > 0 ? `M${x2} ${y}l-11 -6v12z` : `M${x2} ${y}l11 -6v12z`} fill={C.mid} />}
      {active && (
        <g clipPath={`url(#clip-${id})`}>
          <text x={tx} y={y - 14} textAnchor={dir > 0 ? "start" : "end"} fontFamily={MONO} fontSize={18} fill={color} letterSpacing={0}>
            {text}
          </text>
        </g>
      )}
    </g>
  );
};

/** Pink check badge that pops in. */
export const Check: React.FC<{ f: number; x: number; y: number; start: number; r?: number; bad?: boolean }> = ({ f, x, y, start, r = 17, bad }) => {
  const s = pop(f, start);
  if (s <= 0) return null;
  return (
    <About x={x} y={y} s={s}>
      <circle cx={x} cy={y} r={r} fill={bad ? C.mid : C.pink} />
      {bad ? (
        <path d={`M${x - r * 0.3} ${y - r * 0.3}l${r * 0.6} ${r * 0.6}m0 ${-r * 0.6}l${-r * 0.6} ${r * 0.6}`} stroke={C.text} strokeWidth={3} strokeLinecap="round" />
      ) : (
        <path d={`M${x - r * 0.4} ${y + r * 0.02}l${r * 0.28} ${r * 0.28}l${r * 0.52} ${-r * 0.56}`} fill="none" stroke="#1E1E1E" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </About>
  );
};

/** Text that types in, one character per `cps` frames. */
export const typed = (s: string, f: number, start: number, cpf = 1.2) => s.slice(0, Math.max(0, Math.floor((f - start) * cpf)));

/** Terminal command chip at the top of a step. */
export const Cmd: React.FC<{ f: number; cmd: string; x?: number; y?: number; w?: number; start?: number }> = ({ f, cmd, x = 960, y = 150, w = 820, start = 4 }) => {
  const s = pop(f, start);
  const shown = typed(cmd, f, start + 8, 1.4);
  const blink = Math.floor(f / 15) % 2 === 0 || shown.length < cmd.length;
  return (
    <About x={x} y={y} s={0.9 + 0.1 * s} o={Math.min(1, s)}>
      <rect x={x - w / 2} y={y - 34} width={w} height={68} rx={8} fill={C.panel} stroke={C.line2} strokeWidth={1.5} />
      <text x={x - w / 2 + 28} y={y + 8} fontFamily={MONO} fontSize={24} fill={C.text}>
        <tspan fill={C.pink}>$ </tspan>{shown}
        {blink && <tspan fill={C.pink}>▍</tspan>}
      </text>
    </About>
  );
};

/** Node for a text-generation LLM: grey tile with animated generation dots while `busy`. */
export const LlmNode: React.FC<{ f: number; x: number; y: number; size?: number; start: number; busyFrom?: number; busyTo?: number; label?: string }> = ({
  f, x, y, size = 200, start, busyFrom = 1e9, busyTo = 0, label = "LLM",
}) => {
  const s = pop(f, start);
  const busy = f >= busyFrom && f < busyTo;
  return (
    <About x={x} y={y} s={s}>
      <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={20} fill={C.panel} stroke={C.dim} strokeWidth={2} />
      <rect x={x - size / 2 + 14} y={y - size / 2 + 14} width={size - 28} height={size - 28} rx={12} fill="none" stroke={C.line} strokeWidth={1.5} />
      <text x={x} y={y + 6} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={size * 0.2} fill={C.text}>{label}</text>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x - 22 + i * 22} cy={y + size * 0.24} r={5}
          fill={busy && Math.floor(f / 5) % 3 === i ? C.text : C.mid} />
      ))}
    </About>
  );
};

/** Jev's node: pink-edged tile carrying the jev-swap switch. */
export const JevNode: React.FC<{ f: number; x: number; y: number; size?: number; start: number; glowAt?: number }> = ({ f, x, y, size = 220, start, glowAt = 1e9 }) => {
  const s = pop(f, start);
  const g = t(f, glowAt, glowAt + 8) * (1 - t(f, glowAt + 14, glowAt + 40));
  return (
    <About x={x} y={y} s={s}>
      <rect x={x - size / 2 - 14} y={y - size / 2 - 14} width={size + 28} height={size + 28} rx={28} fill={C.pink} opacity={0.08 + 0.2 * g} />
      <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={20} fill={C.panel} stroke={C.pink} strokeWidth={2.5} />
      <Mark x={x} y={y - size * 0.08} size={size * 0.5} knob={t(f, start + 8, start + 22)} />
      <text x={x} y={y + size * 0.34} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={size * 0.12} fill={C.pink}>jev</text>
    </About>
  );
};

/** Small underlined label, like the reference's captions on diagrams. */
export const Label: React.FC<{ x: number; y: number; text: string; o?: number; color?: string; anchor?: "start" | "middle" | "end"; size?: number }> = ({
  x, y, text, o = 1, color = C.soft, anchor = "middle", size = 17,
}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={MONO} fontSize={size} fill={color} opacity={o} textDecoration="underline">
    {text}
  </text>
);

/** On-screen narration: an eyebrow tag and one caption at a time, fading between lines. */
export const Caption: React.FC<{ f: number; dur: number; eyebrow?: string; lines: [number, string][] }> = ({ f, dur, eyebrow, lines }) => {
  const idx = lines.reduce((acc, [from], i) => (f >= from ? i : acc), -1);
  if (idx < 0) return null;
  const [from, text] = lines[idx];
  const to = idx + 1 < lines.length ? lines[idx + 1][0] : dur;
  const o = Math.min(t(f, from, from + 12), 1 - t(f, to - 10, to));
  const y = t(f, from, from + 14, 14, 0);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 92 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: o, transform: `translateY(${y}px)`, maxWidth: 1400 }}>
        {eyebrow && <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.04em", color: C.pink }}>{eyebrow}</div>}
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 44, lineHeight: 1.2, letterSpacing: "-0.02em", color: C.text, textAlign: "center", textWrap: "balance" }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
