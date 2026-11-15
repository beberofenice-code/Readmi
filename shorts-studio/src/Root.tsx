import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { EveryoneGone, EVERYONE_GONE_FRAMES } from "./videos/everyone-gone/EveryoneGone";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DashcamShort"
        component={DashcamShort}
        durationInFrames={1867}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="EveryoneGone"
        component={EveryoneGone}
        durationInFrames={EVERYONE_GONE_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
