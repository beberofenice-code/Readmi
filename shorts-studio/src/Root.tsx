import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { LighthouseShort, LIGHTHOUSE_FRAMES } from "./videos/lighthouse/LighthouseShort";

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
        id="LighthouseShort"
        component={LighthouseShort}
        durationInFrames={LIGHTHOUSE_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
