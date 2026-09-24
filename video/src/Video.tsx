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

// Music (public/music.mp3, Lyria 3 Pro, 120 BPM so bars are 2 s): the main drop at 16 s lands on the Jev reveal,
// then the track jumps ahead on a bar line so its second drop (48 s) lands on the outro.
const BAR = 2 * FPS;
const MUSIC_FROM = 16 * FPS - start("jev");
const CUT = start("outro") - BAR; // video frame of the jump
const JUMP_TO = 48 * FPS - BAR; // music frame played from the cut
const VO_SPANS = SCENES.flatMap((sc) => sc.lines.map((l) => [sc.from + l.at, sc.from + l.at + l.frames] as const));
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const musicLevel = (f: number) => {
  // Duck under the voice with 6-frame ramps; fade in at the start and out at the end.
  const near = Math.min(...VO_SPANS.map(([a, b]) => (f < a ? a - f : f > b ? f - b : 0)));
  const duck = interpolate(near, [0, 6], [0.2, 0.5], clamp);
  return duck * Math.min(interpolate(f, [0, 8], [0, 1], clamp), interpolate(f, [TOTAL - 45, TOTAL], [1, 0], clamp));
};

export const WhatIsJevSwap: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop f={f} />
      <Sequence durationInFrames={CUT + 2} layout="none">
        <Html5Audio src={staticFile("music.mp3")} trimBefore={MUSIC_FROM} volume={(f) => musicLevel(f) * interpolate(f, [CUT - 2, CUT + 2], [1, 0], clamp)} />
      </Sequence>
      <Sequence from={CUT - 2} layout="none">
        <Html5Audio src={staticFile("music.mp3")} trimBefore={JUMP_TO - 2} volume={(f) => musicLevel(f + CUT - 2) * interpolate(f, [0, 4], [0, 1], clamp)} />
      </Sequence>
      {SCENES.map((sc) => (
        <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur} layout="none">
          <WarpCtx.Provider value={warpFor(sc)}>
            <AbsoluteFill><sc.C dur={sc.dur} cap={sc.lines.map((l) => [l.at, l.show])} /></AbsoluteFill>
          </WarpCtx.Provider>
          {sc.lines.map((l) => (
            <Sequence key={l.file} from={l.at} durationInFrames={l.frames + 2} layout="none">
              <Html5Audio src={staticFile(l.file)} />
            </Sequence>
          ))}
        </Sequence>
      ))}
      <Sequence from={start("scan") - 10} durationInFrames={20} layout="none">
        <Wipe dur={20} />
      </Sequence>
    </AbsoluteFill>
  );
};

// The jump is seamless only when the music time at the cut is also on a bar line.
export const MUSIC_PHASE_ERROR_S = (((CUT + MUSIC_FROM) % BAR) + BAR) % BAR / FPS;
