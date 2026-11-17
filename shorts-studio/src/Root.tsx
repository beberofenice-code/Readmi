import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { Think100xFaster, THINK100X_FRAMES } from "./videos/think-100x-faster/Think100xFaster";

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
        id="Think100xFaster"
        component={Think100xFaster}
        durationInFrames={THINK100X_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
