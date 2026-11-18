import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { ZombieApocalypseShort } from "./videos/zombie-apocalypse/ZombieApocalypseShort";

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
        id="ZombieApocalypseShort"
        component={ZombieApocalypseShort}
        durationInFrames={1992}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
