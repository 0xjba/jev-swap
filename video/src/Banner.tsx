import React from "react";
import { AbsoluteFill } from "remotion";
import { C, MONO, SANS } from "./theme";
import { Mark } from "./ui";

/** README / npm banner (1280x640, GitHub's social-preview size): the mark, the wordmark and one line. */
export const Banner: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={1280} height={640} viewBox="0 0 1280 640">
      <defs>
        <pattern id="bdots" width="32" height="32" patternUnits="userSpaceOnUse" x="8" y="0">
          <circle cx="2" cy="2" r="1.1" fill="#2A2B2F" />
        </pattern>
        <radialGradient id="bglow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={C.pink2} stopOpacity="0.16" />
          <stop offset="1" stopColor={C.pink2} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bvig" cx="50%" cy="46%" r="72%">
          <stop offset="55%" stopColor={C.bg} stopOpacity="0" />
          <stop offset="100%" stopColor="#0C0C0D" stopOpacity="0.95" />
        </radialGradient>
      </defs>
      <rect width="1280" height="640" fill="url(#bdots)" />
      <ellipse cx="470" cy="300" rx="520" ry="320" fill="url(#bglow)" />
      <rect width="1280" height="640" fill="url(#bvig)" />
      <Mark x={362} y={286} size={176} />
      <text x={466} y={328} fontFamily={MONO} fontWeight={600} fontSize={112} letterSpacing={-4} fill={C.text}>
        jev<tspan fill={C.muted} fontWeight={500}>-swap</tspan>
      </text>
      <text x={640} y={452} textAnchor="middle" fontFamily={SANS} fontWeight={500} fontSize={36} letterSpacing={-0.8} fill={C.body}>
        Find the decisions. Swap them to Jev. <tspan fill={C.pink}>Prove it.</tspan>
      </text>
    </svg>
  </AbsoluteFill>
);
