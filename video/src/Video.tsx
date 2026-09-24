import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import narration from "../narration.json";
import vo from "./vo.json";
import { FPS } from "./theme";
import { Backdrop, WarpCtx } from "./ui";
import { Convert, Cost, Intro, Jev, Outro, Problem, Scan, Shadow, Wipe } from "./scenes";

type SceneFC = React.FC<{ dur: number; cap: [number, string][] }>;

// Per scene: the visual frame each narration line starts on (chosen at settled moments), and the visual length.
const VISUAL: Record<string, { C: SceneFC; at: number[]; end: number }> = {
  intro: { C: Intro, at: [66], end: 120 },
  problem: { C: Problem, at: [8, 44, 46], end: 330 },
  jev: { C: Jev, at: [8, 36, 188], end: 300 },
  scan: { C: Scan, at: [4, 66], end: 270 },
  cost: { C: Cost, at: [8, 162], end: 330 },
  convert: { C: Convert, at: [8, 86], end: 250 },
  shadow: { C: Shadow, at: [8, 44, 215], end: 300 },
  outro: { C: Outro, at: [40, 60], end: 210 },
};
const GAP = 10; // frames of breath between lines
const TAIL = 30; // frames after a scene's last line

type Line = { at: number; vis: number; show: string; file: string; frames: number };
type Scene = { id: string; C: SceneFC; from: number; dur: number; lines: Line[]; vEnd: number };

function timeline(): Scene[] {
  let from = 0;
  return narration.scenes.map((sc) => {
    const v = VISUAL[sc.id];
    const lines: Line[] = [];
    let at = v.at[0];
    sc.lines.forEach((l, k) => {
      const clip = (vo as Record<string, { file: string; seconds: number }>)[`${sc.id}-${k}`];
      const frames = Math.ceil(clip.seconds * FPS);
      lines.push({ at, vis: v.at[k], show: l.show, file: clip.file, frames });
      const nextVis = k + 1 < v.at.length ? v.at[k + 1] : v.end;
      at += Math.max(frames + (k + 1 < sc.lines.length ? GAP : TAIL), nextVis - v.at[k]);
    });
    const s: Scene = { id: sc.id, C: v.C, from, dur: at, lines, vEnd: v.end };
    from += at;
    return s;
  });
}

export const SCENES = timeline();
export const TOTAL = SCENES.reduce((s, sc) => s + sc.dur, 0);
const WIPE_AT = SCENES.find((s) => s.id === "scan")!.from;

/** Visual time plays at 1x from each line's anchor and holds at the next anchor until that line starts. */
const warpFor = (sc: Scene) => (f: number) => {
  const L = sc.lines;
  if (f < L[0].at) return f - L[0].at + L[0].vis;
  for (let k = L.length - 1; k >= 0; k--) {
    if (f >= L[k].at) return Math.min(L[k].vis + (f - L[k].at), k + 1 < L.length ? L[k + 1].vis : sc.vEnd);
  }
  return f;
};

export const WhatIsJevSwap: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop f={f} />
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
      <Sequence from={WIPE_AT - 14} durationInFrames={28} layout="none">
        <Wipe dur={28} />
      </Sequence>
    </AbsoluteFill>
  );
};
