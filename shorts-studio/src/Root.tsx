import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { ZombieApocalypseShort } from "./videos/zombie-apocalypse/ZombieApocalypseShort";
import { CigaretteShort } from "./videos/cigarette/CigaretteShort";

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
      <Composition
        id="CigaretteShort"
        component={CigaretteShort}
        durationInFrames={1860}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
