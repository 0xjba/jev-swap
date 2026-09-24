import React from "react";
import { Composition } from "remotion";
import { FPS, H, W } from "./theme";
import { TOTAL, WhatIsJevSwap } from "./Video";

export const Root: React.FC = () => (
  <Composition id="WhatIsJevSwap" component={WhatIsJevSwap} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
