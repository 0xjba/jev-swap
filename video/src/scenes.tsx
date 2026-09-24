import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FPS, MONO, SANS } from "./theme";
import { HalftoneMark } from "./HalftoneMark";
import { About, Cam, Caption, useWarp, Check, Cmd, JevNode, Label, Lines, LlmNode, Stream, Win, pop, t, typed } from "./ui";

type P = { dur: number; cap: [number, string][] };

/* 1 · Logo: the j draws in and its switch flips on. */
export const Intro: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const word = "jev-swap";
  const n = Math.max(0, Math.min(word.length, Math.floor((f - 44) / 2.2)));
  return (
    <>
      <Cam f={raw} dur={dur}>
        <HalftoneMark x={960} y={430} size={200} reveal={t(f, 4, 38)} knob={t(f, 36, 56)} />
        <text x={960} y={620} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={80} letterSpacing={-2} fill={C.text}>
          {word.slice(0, Math.min(3, n))}
          <tspan fill={C.muted} fontWeight={500}>{word.slice(3, n)}</tspan>
        </text>
        <text x={960} y={700} textAnchor="middle" fontFamily={SANS} fontSize={36} fill={C.body} opacity={t(f, 70, 86)}>
          Stop paying LLM prices for decisions.
        </text>
      </Cam>
    </>
  );
};

/* 2 · The problem: a decision goes to a text model, which writes its answer out token by token. */
export const Problem: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const resp = ["{", '  "category": "billing",', '  "urgent": true,', '  "priority": 3', "}"];
  const all = resp.join("\n");
  const shown = typed(all, f, 112, 0.75);
  const split = shown.split("\n");
  const settle = t(f, 222, 240);
  const values: Record<number, [string, string]> = { 1: ['  "category": ', '"billing"'], 2: ['  "urgent": ', "true"], 3: ['  "priority": ', "3"] };
  const tokens = Math.min(1, Math.max(0, (f - 112) / (all.length / 0.75)));
  return (
    <>
      <Cam f={raw} dur={dur}>
        <Win x={140} y={250} w={520} h={400} title="support/triage.ts" o={t(f, 0, 12)} s={0.94 + 0.06 * pop(f, 0)}>
          <Lines f={f} x={180} y={330} start={6} dur={30} widths={[240, 330, 180, 280, 220, 300, 150, 260, 200]} indents={[0, 1, 1, 1, 2, 2, 1, 1, 0]} hl={3} hlAt={30} gap={34} />
          <text x={180 + 28 + 300} y={330 + 3 * 34 + 6} fontFamily={MONO} fontSize={17} fill={C.pink} opacity={t(f, 34, 44)}>classify()</text>
        </Win>
        <Label x={400} y={225} text="your app" o={t(f, 10, 22)} />
        <Stream f={f} id="p1" x1={676} x2={836} y={450} start={46} dur={40} text="charged twice, refund please" />
        <LlmNode f={f} x={960} y={450} start={20} busyFrom={92} busyTo={218} />
        <Label x={960} y={320} text="text model" o={t(f, 28, 40)} />
        <Stream f={f} id="p2" x1={1084} x2={1214} y={450} start={96} dur={60} text='{"category": "billing", ...' color={C.soft} />
        <Win x={1230} y={250} w={560} h={400} title="response" o={t(f, 84, 96)} s={0.94 + 0.06 * pop(f, 84)}>
          {split.map((line, i) => {
            const v = values[i];
            const full = resp[i];
            const done = line.length === full.length;
            return (
              <text key={i} x={1266} y={340 + i * 46} fontFamily={MONO} fontSize={26} fill={C.soft} xmlSpace="preserve">
                {v && done && settle > 0 ? (
                  <>
                    <tspan opacity={1 - 0.7 * settle}>{v[0]}</tspan>
                    <tspan fill={interpolate(settle, [0, 1], [0, 1]) > 0.5 ? C.pink : C.soft} fontWeight={600}>{v[1]}</tspan>
                    <tspan opacity={1 - 0.7 * settle}>{full.slice(v[0].length + v[1].length)}</tspan>
                  </>
                ) : (
                  <tspan opacity={i === 0 || i === 4 ? 1 - 0.7 * settle : 1}>{line}</tspan>
                )}
              </text>
            );
          })}
          <text x={1266} y={604} fontFamily={MONO} fontSize={17} fill={C.muted}>output tokens billed</text>
          <rect x={1520} y={592} width={234} height={12} rx={6} fill={C.line} />
          <rect x={1520} y={592} width={234 * tokens} height={12} rx={6} fill={C.dim} />
        </Win>
      </Cam>
      <Caption f={raw} dur={dur} eyebrow="// the problem" lines={cap} />
    </>
  );
};

/* 3 · Jev: the same input and typed questions in, typed answers with confidence out. */
export const Jev: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const qs: [string, string][] = [["choice", "category"], ["noul", "urgent?"], ["score", "priority 1–5"]];
  const rows: [string, string, number][] = [["category", "billing", 0.9], ["urgent", "yes", 0.72], ["priority", "3", 0.62]];
  return (
    <>
      <Cam f={raw} dur={dur}>
        <Win x={130} y={370} w={400} h={160} title="input" o={t(f, 0, 12)} s={0.94 + 0.06 * pop(f, 0)}>
          <text x={160} y={470} fontFamily={MONO} fontSize={22} fill={C.text}>{typed("Charged twice,", f, 8, 1.5)}</text>
          <text x={160} y={504} fontFamily={MONO} fontSize={22} fill={C.text}>{typed("refund please.", f, 18, 1.5)}</text>
        </Win>
        <Stream f={f} id="j1" x1={546} x2={826} y={450} start={80} dur={40} text="charged twice, refund please" />
        <JevNode f={f} x={960} y={450} start={14} glowAt={126} />
        {qs.map(([kind, q], i) => {
          const x = 720 + i * 240;
          const s = pop(f, 36 + i * 10);
          return (
            <g key={q}>
              <line x1={x} y1={258} x2={960 + (i - 1) * 60} y2={326} stroke={C.mid} strokeWidth={1.5} strokeDasharray="4 6" opacity={s} />
              <About x={x} y={230} s={s}>
                <rect x={x - 108} y={206} width={216} height={48} rx={24} fill={C.panel} stroke={C.line2} strokeWidth={1.5} />
                <text x={x} y={237} textAnchor="middle" fontFamily={MONO} fontSize={18} fill={C.soft}>
                  <tspan fill={C.pink}>{kind}</tspan> {q}
                </text>
              </About>
            </g>
          );
        })}
        <Label x={960} y={180} text="typed questions" o={t(f, 36, 50)} />
        <Stream f={f} id="j2" x1={1094} x2={1204} y={450} start={128} dur={24} text="answers" color={C.soft} />
        <Win x={1220} y={280} w={560} h={340} title="typed answer" accent o={t(f, 128, 140)} s={0.94 + 0.06 * pop(f, 128)}>
          {rows.map(([k, v, w], i) => {
            const on = t(f, 146 + i * 10, 162 + i * 10);
            const y = 392 + i * 58;
            return (
              <g key={k} opacity={on}>
                <text x={1256} y={y} fontFamily={MONO} fontSize={22} fill={C.muted}>{k}</text>
                <text x={1420} y={y} fontFamily={MONO} fontSize={24} fontWeight={600} fill={C.pink}>{v}</text>
                <rect x={1556} y={y - 12} width={190} height={10} rx={5} fill={C.line} />
                <rect x={1556} y={y - 12} width={190 * w * on} height={10} rx={5} fill={C.pink} />
              </g>
            );
          })}
          <text x={1746} y={346} textAnchor="end" fontFamily={MONO} fontSize={15} fill={C.muted} opacity={t(f, 150, 162)}>confidence</text>
          <line x1={1244} x2={1756} y1={556} y2={556} stroke={C.line} strokeWidth={1.5} opacity={t(f, 190, 200)} />
          <text x={1256} y={592} fontFamily={MONO} fontSize={18} fill={C.soft} opacity={t(f, 196, 208)}>
            no text generated · <tspan fill={C.pink}>no output tokens billed</tspan>
          </text>
        </Win>
      </Cam>
      <Caption f={raw} dur={dur} eyebrow="// typesafe jev" lines={cap} />
    </>
  );
};

/* Pink panel sweep between the idea and the tool (the reference's colour-wipe cut). */
export const Wipe: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, dur], [-2100, 1920], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080}>
        <defs>
          <linearGradient id="wipe" x1="0" x2="1">
            <stop offset="0" stopColor={C.pink2} />
            <stop offset="1" stopColor={C.pink} />
          </linearGradient>
        </defs>
        <rect x={x} y={0} width={2100} height={1080} fill="url(#wipe)" />
      </svg>
    </AbsoluteFill>
  );
};

/* 4 · Scan: a sweep across the codebase flags the decision calls. */
export const Scan: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const cols = 4, w = 300, h = 190, gx = 44, gy = 64;
  const x0 = 960 - (cols * w + (cols - 1) * gx) / 2;
  const files = ["api/tickets.ts", "lib/format.ts", "mail/filter.py", "ui/table.tsx", "mod/review.ts", "db/client.py", "jobs/triage.py", "util/dates.ts"];
  const flags: Record<number, string> = { 0: "enum", 2: "yes / no", 4: "boolean", 6: "score 1–5" };
  const sweep = interpolate(f, [70, 180], [x0 - 40, x0 + cols * (w + gx)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Cam f={raw} dur={dur}>
        <Cmd f={f} cmd="npx jev-swap scan ./app" />
        {files.map((name, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const x = x0 + c * (w + gx), y = 270 + r * (h + gy);
          const passed = sweep > x + w / 2;
          const passAt = 70 + ((x + w / 2 - (x0 - 40)) / (cols * (w + gx) + 40)) * 110;
          const flagged = flags[i] !== undefined;
          return (
            <g key={name}>
              <Win x={x} y={y} w={w} h={h} title={name} accent={flagged && passed} o={t(f, 18 + i * 4, 30 + i * 4) * (passed && !flagged ? 0.45 : 1)} s={0.9 + 0.1 * pop(f, 18 + i * 4)}>
                <Lines f={f} x={x + 26} y={y + 76} start={20 + i * 4} dur={16} gap={26} widths={[120, 180, 90, 150, 110]} indents={[0, 1, 1, 1, 0]} hl={flagged ? 2 : -1} hlAt={passAt} />
              </Win>
              {flagged && <Check f={f} x={x + w - 4} y={y + 4} start={passAt + 2} />}
              {flagged && (
                <text x={x + w / 2} y={y + h + 34} textAnchor="middle" fontFamily={MONO} fontSize={18} fill={C.pink} opacity={t(f, passAt + 4, passAt + 14)}>
                  {flags[i]}
                </text>
              )}
            </g>
          );
        })}
        {f > 68 && f < 186 && (
          <g>
            <rect x={sweep - 60} y={240} width={60} height={2 * h + gy + 70} fill={C.pink} opacity={0.07} />
            <line x1={sweep} x2={sweep} y1={240} y2={240 + 2 * h + gy + 70} stroke={C.pink} strokeWidth={2.5} />
          </g>
        )}
      </Cam>
      <Caption f={raw} dur={dur} eyebrow="// 01 scan" lines={cap} />
    </>
  );
};

/* 5 · Cost and speed: a race at real speed, then per-call costs. Figures are the site's sourced example. */
export const Cost: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  // Claude Sonnet 5 vs Jev, 400-in / 20-out-token call (site/gen/build.py): OpenRouter list prices and latency
  // fetched 2026-09-24; Jev at its p50 over 45 live calls (data/jev-measure.json).
  const LLM_MS = 3148, JEV_MS = 327;
  const go = 44;
  const x0 = 470, x1 = 1640;
  const pl = interpolate(f, [go, go + (LLM_MS / 1000) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pj = interpolate(f, [go, go + (JEV_MS / 1000) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clock = Math.max(0, Math.min(LLM_MS, ((f - go) / FPS) * 1000));
  const lanes: [string, number, string, string][] = [["Claude Sonnet 5", pl, "3.1 s", C.soft], ["jev", pj, "327 ms", C.pink]];
  const cards: [string, string, string, boolean][] = [
    ["Claude Sonnet 5 · per call", "$0.001000", "$1,000 per million calls", false],
    ["jev · per call", "$0.0000241", "$24.11 per million calls", true],
  ];
  return (
    <>
      <Cam f={raw} dur={dur}>
        <text x={x1} y={200} textAnchor="end" fontFamily={MONO} fontSize={24} fill={C.muted} opacity={t(f, 20, 32)}>
          {(clock / 1000).toFixed(2)} s
        </text>
        <Label x={x0} y={200} anchor="start" text="one decision call, real time" o={t(f, 20, 32)} />
        {lanes.map(([name, p, time, col], i) => {
          const y = 270 + i * 110;
          const done = p >= 1;
          return (
            <g key={name} opacity={t(f, 10 + i * 6, 24 + i * 6)}>
              <text x={x0 - 30} y={y + 8} textAnchor="end" fontFamily={MONO} fontSize={24} fontWeight={i ? 600 : 400} fill={col}>{name}</text>
              <rect x={x0} y={y - 3} width={x1 - x0} height={6} rx={3} fill={C.line} />
              <rect x={x0} y={y - 3} width={(x1 - x0) * p} height={6} rx={3} fill={i ? C.pink : C.dim} />
              <circle cx={x0 + (x1 - x0) * p} cy={y} r={11} fill={i ? C.pink : C.soft} />
              {done && <Check f={f} x={x1 + 44} y={y} start={go + (i ? (JEV_MS / 1000) * FPS : (LLM_MS / 1000) * FPS)} bad={false} r={15} />}
              <text x={x1 + 76} y={y + 8} fontFamily={MONO} fontSize={22} fill={col} opacity={done ? 1 : 0}>{time}</text>
            </g>
          );
        })}
        {cards.map(([k, big, sub, pink], i) => {
          const x = 250 + i * 480, s = pop(f, 166 + i * 10);
          return (
            <About key={k} x={x + 210} y={620} s={0.92 + 0.08 * s} o={Math.min(1, s)}>
              <rect x={x} y={530} width={420} height={180} rx={8} fill={C.panel} stroke={pink ? C.pink : C.line2} strokeWidth={1.5} />
              <text x={x + 28} y={576} fontFamily={MONO} fontSize={18} fill={pink ? C.pink : C.muted}>{k}</text>
              <text x={x + 28} y={642} fontFamily={MONO} fontSize={46} letterSpacing={-1} fill={pink ? C.pink : C.text}>{big}</text>
              <text x={x + 28} y={686} fontFamily={SANS} fontSize={20} fill={C.body}>{sub}</text>
            </About>
          );
        })}
        {(() => {
          const s = pop(f, 192);
          return (
            <About x={1460} y={620} s={0.92 + 0.08 * s} o={Math.min(1, s)}>
              <rect x={1250} y={530} width={420} height={180} rx={8} fill={C.pink2} />
              <text x={1278} y={576} fontFamily={MONO} fontSize={18} fill={C.pinkPale}>difference</text>
              <text x={1278} y={642} fontFamily={MONO} fontSize={46} letterSpacing={-1} fill="#FFFFFF">97.6% lower</text>
              <text x={1278} y={686} fontFamily={SANS} fontSize={20} fill={C.pinkPale}>41.5× cheaper · 9.6× faster</text>
            </About>
          );
        })()}
        <text x={960} y={764} textAnchor="middle" fontFamily={SANS} fontSize={17} fill={C.muted} opacity={t(f, 212, 226)}>
          400 input / 20 output tokens at OpenRouter list prices and p50 latency, 2026-09-24. Jev: p50 over 45 live calls.
        </text>
      </Cam>
      <Caption f={raw} dur={dur} eyebrow="// 02 cost and speed" lines={cap} />
    </>
  );
};

/* 6 · Convert: a generated module, and the confidence gate that falls back to the LLM. */
export const Convert: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const code: [string, string][] = [
    ["export const THRESHOLD = 0.7;", C.text],
    ["", C.text],
    ["export async function decide(state) {", C.text],
    ["  // typed questions -> typed answer", C.com],
    ["}", C.text],
    ["", C.text],
    ["export async function", C.text],
    ["  decideWithFallback(state, llm) {", C.text],
    ["  // Jev if confident, else your LLM", C.com],
    ["}", C.text],
  ];
  const gx = 1060, gy = 470;
  // Two calls through the gate: one confident (stays on Jev), one not (falls back).
  const tok = (start: number, up: boolean) => {
    const p1 = t(f, start, start + 22), p2 = t(f, start + 26, start + 50);
    const x = p2 > 0 ? 1330 + 240 * p2 : 880 + 450 * p1;
    const y = p2 > 0 ? gy + (up ? -130 : 130) * p2 : gy;
    return { x, y, o: t(f, start, start + 4) * (1 - t(f, start + 56, start + 64)) };
  };
  const a = tok(96, true), b = tok(160, false);
  return (
    <>
      <Cam f={raw} dur={dur}>
        <Cmd f={f} cmd="npx jev-swap convert" />
        <Win x={130} y={250} w={640} h={470} title="jev/classifyTicket.ts" o={t(f, 10, 22)} s={0.94 + 0.06 * pop(f, 10)}>
          {code.map(([line, col], i) => (
            <text key={i} x={166} y={332 + i * 38} fontFamily={MONO} fontSize={21} fill={col} xmlSpace="preserve">
              {typed(line, f, 20 + i * 5, 3)}
            </text>
          ))}
        </Win>
        <g opacity={t(f, 50, 64)}>
          <line x1={880} x2={gx - 70} y1={gy} y2={gy} stroke={C.mid} strokeWidth={2} />
          <line x1={gx + 70} x2={1330} y1={gy} y2={gy} stroke={C.mid} strokeWidth={2} />
          <path d={`M1330 ${gy}L1570 ${gy - 130}H1600`} fill="none" stroke={C.pink} strokeWidth={2} />
          <path d={`M1330 ${gy}L1570 ${gy + 130}H1600`} fill="none" stroke={C.mid} strokeWidth={2} strokeDasharray="6 8" />
          <rect x={1300} y={gy - 30} width={60} height={60} rx={6} transform={`rotate(45 1330 ${gy})`} fill={C.panel} stroke={C.soft} strokeWidth={2} />
          <text x={1330} y={gy + 7} textAnchor="middle" fontFamily={MONO} fontSize={22} fill={C.text}>≥</text>
          <Label x={1330} y={gy + 80} text="confidence ≥ threshold?" size={16} />
          <text x={1616} y={gy - 124} fontFamily={MONO} fontSize={21} fill={C.pink}>use Jev&apos;s answer</text>
          <text x={1616} y={gy + 136} fontFamily={MONO} fontSize={21} fill={C.soft}>your current LLM</text>
        </g>
        <JevNode f={f} x={gx} y={gy} size={130} start={50} glowAt={112} />
        {[a, b].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={10} fill={i === 0 ? C.pink : C.soft} opacity={p.o} />)}
        <Check f={f} x={1600} y={gy - 180} start={146} />
        <Check f={f} x={1600} y={gy + 80} start={210} bad />
      </Cam>
      <Caption f={raw} dur={dur} eyebrow="// 03 convert" lines={cap} />
    </>
  );
};

/* 7 · Shadow: recorded calls replayed through Jev, agreement vs threshold, recommended threshold. */
export const Shadow: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const agree = [true, true, false, true, true, true];
  const cx = 1010, cy = 250, cw = 760, ch = 470;
  // Illustrative curve only: agreement on covered calls rising with the threshold (no values shown).
  const pts = Array.from({ length: 41 }, (_, i) => {
    const u = i / 40;
    return [cx + 70 + u * (cw - 120), cy + ch - 80 - (ch - 170) * (0.35 + 0.62 * (1 - Math.exp(-4.2 * u)))];
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const target = cy + ch - 80 - (ch - 170) * 0.9;
  const hit = pts.find(([, y]) => y <= target) ?? pts[pts.length - 1];
  return (
    <>
      <Cam f={raw} dur={dur}>
        <Cmd f={f} cmd="npx jev-swap shadow samples.jsonl" />
        <Label x={140} y={236} anchor="start" text="recorded calls" o={t(f, 44, 56)} />
        {agree.map((ok, i) => {
          const y = 262 + i * 78, s = pop(f, 50 + i * 12);
          return (
            <About key={i} x={470} y={y + 28} s={0.9 + 0.1 * s} o={Math.min(1, s)}>
              <rect x={140} y={y} width={660} height={58} rx={6} fill={C.panel} stroke={C.line2} strokeWidth={1.5} />
              <text x={164} y={y + 36} fontFamily={MONO} fontSize={19} fill={C.muted}>call {String(i + 1).padStart(2, "0")}</text>
              <text x={330} y={y + 36} fontFamily={MONO} fontSize={19} fill={C.soft}>LLM</text>
              <rect x={384} y={y + 23} width={110} height={10} rx={5} fill={C.dim} />
              <text x={530} y={y + 36} fontFamily={MONO} fontSize={19} fill={C.pink}>jev</text>
              <rect x={578} y={y + 23} width={110} height={10} rx={5} fill={ok ? C.pink : C.mid} />
              <Check f={f} x={756} y={y + 29} start={64 + i * 12} r={15} bad={!ok} />
            </About>
          );
        })}
        <Win x={cx} y={cy} w={cw} h={ch} o={t(f, 110, 124)} s={0.94 + 0.06 * pop(f, 110)}>
          <line x1={cx + 70} x2={cx + cw - 40} y1={cy + ch - 80} y2={cy + ch - 80} stroke={C.mid} strokeWidth={1.5} />
          <line x1={cx + 70} x2={cx + 70} y1={cy + 60} y2={cy + ch - 80} stroke={C.mid} strokeWidth={1.5} />
          <text x={cx + cw - 40} y={cy + ch - 40} textAnchor="end" fontFamily={MONO} fontSize={17} fill={C.muted}>confidence threshold →</text>
          <text x={cx + 70} y={cy + 42} fontFamily={MONO} fontSize={17} fill={C.muted}>agreement with your LLM</text>
          <line x1={cx + 70} x2={cx + cw - 40} y1={target} y2={target} stroke={C.soft} strokeWidth={1.5} strokeDasharray="6 8" opacity={t(f, 180, 190)} />
          <text x={cx + 90} y={target - 12} fontFamily={MONO} fontSize={16} fill={C.soft} opacity={t(f, 180, 190)}>your target</text>
          <path d={d} fill="none" stroke={C.pink} strokeWidth={3} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - t(f, 130, 190)} />
        </Win>
        {(() => {
          const s = pop(f, 200);
          return (
            <About x={hit[0]} y={hit[1]} s={s}>
              <line x1={hit[0]} x2={hit[0]} y1={hit[1]} y2={cy + ch - 80} stroke={C.pink} strokeWidth={1.5} strokeDasharray="4 6" />
              <circle cx={hit[0]} cy={hit[1]} r={12} fill={C.pink} />
              <text x={hit[0] + 20} y={hit[1] + 50} fontFamily={MONO} fontSize={18} fill={C.pink}>recommended threshold</text>
            </About>
          );
        })()}
      </Cam>
      <Caption f={raw} dur={dur} eyebrow="// 04 shadow" lines={cap} />
    </>
  );
};

/* 8 · Outro: logo and the one command to start. */
export const Outro: React.FC<P> = ({ dur, cap }) => {
  const raw = useCurrentFrame();
  const f = useWarp(raw);
  const cmd = "npx jev-swap scan ./your-app";
  return (
    <Cam f={raw} dur={dur + 20}>
      <HalftoneMark x={780} y={330} size={120} reveal={t(f, 0, 26)} knob={t(f, 24, 42)} />
      <text x={870} y={358} fontFamily={MONO} fontWeight={600} fontSize={76} letterSpacing={-2} fill={C.text} opacity={t(f, 18, 32)}>
        jev<tspan fill={C.muted} fontWeight={500}>-swap</tspan>
      </text>
      <text x={960} y={470} textAnchor="middle" fontFamily={SANS} fontWeight={500} fontSize={44} letterSpacing={-1} fill={C.text} opacity={t(f, 40, 56)}>
        Find the decisions. Swap them to Jev. <tspan fill={C.pink}>Prove it.</tspan>
      </text>
      <Cmd f={f} cmd={cmd} y={610} w={760} start={64} />
      <text x={960} y={740} textAnchor="middle" fontFamily={MONO} fontSize={24} fill={C.muted} opacity={t(f, 110, 126)}>
        github.com/0xjba/jev-swap · npm: jev-swap
      </text>
    </Cam>
  );
};
