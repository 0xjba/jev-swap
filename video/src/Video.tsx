import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import narration from "../narration.json";
import vo from "./vo.json";
import { FPS } from "./theme";
import { Backdrop, WarpCtx } from "./ui";
import { Convert, Cost, Intro, Jev, Outro, Problem, Scan, Shadow, Wipe } from "./scenes";

type SceneFC = React.FC<{ dur: number; cap: [number, string][] }>;

// Per scene: the visual frame each narration line starts on, the visual length, and how fast the animation may
// play ([min, max] x) to fit its line. The cost race stays at 1x: it is drawn in real time.
const VISUAL: Record<string, { C: SceneFC; at: number[]; end: number; speed: [number, number]; lead?: number; tail?: number }> = {
  intro: { C: Intro, at: [50], end: 110, speed: [1.2, 1.6], lead: 1.4 },
  problem: { C: Problem, at: [8, 100], end: 250, speed: [1, 1.8] },
  jev: { C: Jev, at: [20], end: 300, speed: [1, 2] },
  scan: { C: Scan, at: [8], end: 230, speed: [1, 2.2] },
  cost: { C: Cost, at: [8], end: 290, speed: [1, 1] },
  convert: { C: Convert, at: [8], end: 250, speed: [1, 2] },
  shadow: { C: Shadow, at: [8], end: 300, speed: [1, 2.2] },
  outro: { C: Outro, at: [30], end: 210, speed: [1, 1.3], tail: 45 },
};
const GAP = 6; // frames between lines in a scene
const TAIL = 10; // frames after a scene's last line

type Line = { at: number; vis: number; speed: number; show: string; file: string; frames: number };
type Scene = { id: string; C: SceneFC; from: number; dur: number; lines: Line[]; vEnd: number; lead: number };

function timeline(): Scene[] {
  let from = 0;
  return narration.scenes.map((sc) => {
    const v = VISUAL[sc.id];
    const lead = v.lead ?? 1.7;
    const lines: Line[] = [];
    let at = Math.ceil(v.at[0] / lead);
    sc.lines.forEach((l, k) => {
      const clip = (vo as Record<string, { file: string; seconds: number }>)[`${sc.id}-${k}`];
      const frames = Math.ceil(clip.seconds * FPS);
      const pad = k + 1 < sc.lines.length ? GAP : v.tail ?? TAIL;
      const span = (k + 1 < v.at.length ? v.at[k + 1] : v.end) - v.at[k];
      const speed = Math.min(v.speed[1], Math.max(v.speed[0], span / (frames + pad)));
      lines.push({ at, vis: v.at[k], speed, show: l.show, file: clip.file, frames });
      at += Math.max(frames + pad, Math.ceil(span / speed));
    });
    const s: Scene = { id: sc.id, C: v.C, from, dur: at, lines, vEnd: v.end, lead };
    from += at;
    return s;
  });
}

export const SCENES = timeline();
export const TOTAL = SCENES.reduce((s, sc) => s + sc.dur, 0);
const start = (id: string) => SCENES.find((s) => s.id === id)!.from;

/** Visual time runs at each line's speed from its anchor and holds at the next anchor until that line starts. */
const warpFor = (sc: Scene) => (f: number) => {
  const L = sc.lines;
  if (f < L[0].at) return Math.min(f * sc.lead, L[0].vis);
  for (let k = L.length - 1; k >= 0; k--) {
    if (f >= L[k].at) return Math.min(L[k].vis + (f - L[k].at) * L[k].speed, k + 1 < L.length ? L[k + 1].vis : sc.vEnd);
  }
  return f;
};

// Music (public/music.mp3, Lyria 3 Pro): a restrained product-film bed. It is started so its soft closing chord
// (~60.5 s into the track) rings out under the logo. The track is loud (about -12 LUFS), so it sits well below the voice.
const MUSIC_END = 60.5;
const MUSIC_FROM = Math.max(0, Math.round(MUSIC_END * FPS) - TOTAL);
const VO_SPANS = SCENES.flatMap((sc) => sc.lines.map((l) => [sc.from + l.at, sc.from + l.at + l.frames] as const));
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const musicLevel = (f: number) => {
  // About -18 dB under the voice, -12 dB between lines, with 8-frame ramps; fade in at the start.
  const near = Math.min(...VO_SPANS.map(([a, b]) => (f < a ? a - f : f > b ? f - b : 0)));
  return interpolate(near, [0, 8], [0.13, 0.26], clamp) * interpolate(f, [0, 20], [0, 1], clamp);
};

// Sound effects (public/sfx, synthesized by scripts/sfx.py), cued on each scene's animation beats in visual frames.
type Cue = [number, string, number];
const ticks = (from: number, to: number, every: number, vol: number): Cue[] =>
  Array.from({ length: Math.floor((to - from) / every) + 1 }, (_, i) => [from + i * every, `tick${i % 3}`, vol]);
const SFX: Record<string, Cue[]> = {
  intro: [[4, "pop", 0.25], [44, "click", 0.55], ...ticks(46, 62, 2.2, 0.12)],
  problem: [[2, "pop", 0.25], [30, "tick1", 0.3], [48, "whoosh", 0.18], [86, "pop", 0.22], ...ticks(112, 196, 3, 0.1), [224, "chime_low", 0.25]],
  jev: [[2, "pop", 0.2], [14, "reveal", 0.35], [36, "pop", 0.2], [46, "pop", 0.2], [56, "pop", 0.2], [82, "whoosh", 0.18], [130, "chime", 0.3], [146, "tick0", 0.2], [156, "tick1", 0.2], [166, "tick2", 0.2]],
  scan: [...ticks(12, 28, 2, 0.12), [18, "pop", 0.15], [26, "pop", 0.15], [34, "pop", 0.15], [42, "pop", 0.15], [70, "sweep", 0.22], [87, "chime", 0.28], [140, "chime", 0.28]],
  cost: [[44, "zip", 0.3], [54, "chime", 0.3], [138, "chime_low", 0.25], [166, "pop", 0.22], [176, "pop", 0.22], [192, "reveal", 0.35]],
  convert: [...ticks(12, 26, 2, 0.12), ...ticks(20, 70, 3, 0.08), [50, "pop", 0.22], [96, "whoosh", 0.15], [146, "chime", 0.28], [160, "whoosh", 0.15], [210, "chime_low", 0.22]],
  shadow: [...ticks(12, 44, 2, 0.12), ...[0, 1, 2, 3, 4, 5].flatMap((i): Cue[] => [[50 + i * 12, "pop", 0.14], [64 + i * 12, i === 2 ? "chime_low" : "chime", 0.18]]), [200, "reveal", 0.3]],
  outro: [[0, "hit", 0.5], [30, "click", 0.5], ...ticks(72, 92, 2, 0.12)],
};
// Visual frame -> first real scene frame that shows it.
const unwarp = (sc: Scene, v: number) => {
  const w = warpFor(sc);
  for (let f = 0; f < sc.dur; f++) if (w(f) >= v) return f;
  return undefined;
};

export const WhatIsJevSwap: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop f={f} />
      <Html5Audio src={staticFile("music.mp3")} trimBefore={MUSIC_FROM} volume={musicLevel} />
      {SCENES.map((sc) => (
        <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur} layout="none">
          <WarpCtx.Provider value={warpFor(sc)}>
            <AbsoluteFill><sc.C dur={sc.dur} cap={sc.lines.map((l) => [l.at, l.show])} /></AbsoluteFill>
          </WarpCtx.Provider>
          {SFX[sc.id].map(([v, name, vol], i) => {
            const at = unwarp(sc, v);
            return at === undefined ? null : (
              <Sequence key={`sfx-${i}`} from={at} durationInFrames={60} layout="none">
                <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
              </Sequence>
            );
          })}
          {sc.lines.map((l) => (
            <Sequence key={l.file} from={l.at} durationInFrames={l.frames + 2} layout="none">
              <Html5Audio src={staticFile(l.file)} />
            </Sequence>
          ))}
        </Sequence>
      ))}
      <Sequence from={start("scan") - 10} durationInFrames={20} layout="none">
        <Wipe dur={20} />
        <Html5Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  );
};
