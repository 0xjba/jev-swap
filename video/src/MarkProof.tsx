import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "./theme";
import { HalftoneMark } from "./HalftoneMark";

/** Proof sheet for the halftone mark at the sizes it is used. */
export const MarkProof: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={1200} height={420}>
      <HalftoneMark x={190} y={210} size={320} />
      <HalftoneMark x={520} y={250} size={200} knob={0.5} />
      <HalftoneMark x={760} y={270} size={160} knob={0} />
      <HalftoneMark x={950} y={290} size={120} />
      <HalftoneMark x={1100} y={310} size={72} />
    </svg>
  </AbsoluteFill>
);
