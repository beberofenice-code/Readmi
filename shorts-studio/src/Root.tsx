import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { BillionaireShort, BILLIONAIRE_FRAMES } from "./videos/billionaire/BillionaireShort";

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
        id="BillionaireShort"
        component={BillionaireShort}
        durationInFrames={BILLIONAIRE_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
