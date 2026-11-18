import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { BlackHoleShort, BLACKHOLE_FRAMES } from "./videos/blackhole/BlackHoleShort";
import { BlackHoleThumb, BlackHoleThumbWide } from "./videos/blackhole/Thumbnail";

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
        id="BlackHoleShort"
        component={BlackHoleShort}
        durationInFrames={BLACKHOLE_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition id="BlackHoleThumb" component={BlackHoleThumb} durationInFrames={1} fps={30} width={1080} height={1920} />
      <Composition id="BlackHoleThumbWide" component={BlackHoleThumbWide} durationInFrames={1} fps={30} width={1280} height={720} />
    </>
  );
};
