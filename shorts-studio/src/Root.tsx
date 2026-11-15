import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { ShadowWalkedAway, SHADOW_FRAMES } from "./videos/shadow-walked-away/ShadowWalkedAway";

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
        id="ShadowWalkedAway"
        component={ShadowWalkedAway}
        durationInFrames={SHADOW_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
