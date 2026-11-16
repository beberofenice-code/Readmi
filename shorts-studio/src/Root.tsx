import React from "react";
import { Composition } from "remotion";
import { DashcamShort } from "./videos/dashcam/DashcamShort";
import { ElevatorStranger } from "./videos/elevator-stranger/ElevatorStranger";
import { TOTAL as ELEVATOR_STRANGER_TOTAL } from "./videos/elevator-stranger/story";

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
        id="ElevatorStranger"
        component={ElevatorStranger}
        durationInFrames={ELEVATOR_STRANGER_TOTAL}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
