import React from "react";
import { Composition, Still } from "remotion";
import { Banner } from "./Banner";
import { FPS, H, W } from "./theme";
import { TOTAL, WhatIsJevSwap } from "./Video";

export const Root: React.FC = () => (
  <>
    <Composition id="WhatIsJevSwap" component={WhatIsJevSwap} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
    <Still id="Banner" component={Banner} width={1280} height={640} />
  </>
);
