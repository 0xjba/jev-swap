import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Backdrop } from "./ui";
import { Convert, Cost, Intro, Jev, Outro, Problem, Scan, Shadow, Wipe } from "./scenes";

// Scene lengths in frames (30 fps).
const SCENES: [React.FC<{ dur: number }>, number][] = [
  [Intro, 120],
  [Problem, 330],
  [Jev, 300],
  [Scan, 270],
  [Cost, 330],
  [Convert, 250],
  [Shadow, 290],
  [Outro, 210],
];
export const TOTAL = SCENES.reduce((s, [, d]) => s + d, 0);
const WIPE_AT = SCENES.slice(0, 3).reduce((s, [, d]) => s + d, 0);

export const WhatIsJevSwap: React.FC = () => {
  const f = useCurrentFrame();
  let at = 0;
  return (
    <AbsoluteFill>
      <Backdrop f={f} />
      {SCENES.map(([Scene, dur], i) => {
        const from = at;
        at += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <AbsoluteFill><Scene dur={dur} /></AbsoluteFill>
          </Sequence>
        );
      })}
      <Sequence from={WIPE_AT - 14} durationInFrames={28} layout="none">
        <Wipe dur={28} />
      </Sequence>
    </AbsoluteFill>
  );
};
