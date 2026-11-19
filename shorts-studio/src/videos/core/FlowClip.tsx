// Google Flow <-> Three.js shot mixing for Shorts-Studio v2 (style-locked-flow: Flow only animates our own
// Three.js keyframes in Frames mode and never invents an art style; see scripts/flow_style_lock.mjs).
// A shot in story.ts is either rendered live in Three.js (`source: "threejs"`, the default) or plays a
// Google Flow clip (`source: "flow_clip"`). Flow clips are downloaded to assets/flow_clips/shot_XX.mp4,
// conformed by scripts/render.mjs (1080x1920 cover-crop, 30 fps CFR, exact frame count + xfade tail handle,
// audio stripped) into public/flow_clips/, and played here frame-accurately with <OffthreadVideo>.
// HUD and <PopCaptions> stay DOM layers above this, exactly as over the WebGL canvas.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from "remotion";

export type ShotSource = "threejs" | "flow_clip";

/** Optional per-shot fields shared by every story.ts ShotDef. */
export type FlowShotFields = {
  source?: ShotSource;   // default "threejs"
  clip?: string;         // flow_clip: source file, default `assets/flow_clips/shot_XX.mp4`
  clipStart?: number;    // flow_clip: seconds to skip at the head of the Flow clip (default 0)
  clipRate?: number;     // flow_clip: playback speed (1 = native, 1.25 = 25% faster, 0.8 = slow-mo)
  clipFit?: "cover" | "contain"; // cover = crop to 9:16 (default); contain = fit + blurred fill (16:9 sources)
  refStart?: string;     // Start-Frame / Ingredient still sent to Flow (assets/flow_refs/...)
  refEnd?: string;       // optional End-Frame still (dropped by `refs` when the shot doesn't move)
  // style-locked-flow (Stage C): ONLY the motion to add; render.mjs flow-plan wraps it in STYLE_LOCK_PROMPT.
  // No text/signs/counters/HUD, no restyle, no camera change (lintMotion blocks those before any credit is spent).
  flowMotion?: string;
  flowEnd?: boolean;     // force (true) or suppress (false) the End-Frame; default = auto (only when the shot moves)
  flowModel?: string;    // default "Omni 1.1 Flash"; hero beats e.g. "Veo 3.1 - Fast"
  beat?: "dialogue" | "prop" | string; // dialogue/prop beats always stay Three.js
};

export const isFlowShot = (s: { source?: ShotSource }) => s.source === "flow_clip";
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const defaultFlowClip = (id: number) => `assets/flow_clips/shot_${pad2(id)}.mp4`;

/** Plays the conformed clip for a flow_clip shot. `src` is a public/-relative path passed in by render.mjs
 *  (inputProps.flowClips[id]); when absent (clip not downloaded yet) a clearly-marked slate renders instead. */
export const FlowClipLayer: React.FC<{ shot: { id: number; a: number; b: number }; src?: string }> = ({ shot, src }) => {
  if (!src) return <FlowPendingSlate id={shot.id} />;
  return (
    <Sequence from={shot.a} layout="none" name={`flow_shot_${pad2(shot.id)}`}>
      <AbsoluteFill>
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </Sequence>
  );
};

export const FlowPendingSlate: React.FC<{ id: number }> = ({ id }) => (
  <AbsoluteFill
    style={{
      background: "repeating-linear-gradient(45deg,#1d1f2b 0 60px,#262a3a 60px 120px)",
      color: "#ffd84a",
      fontFamily: "sans-serif",
      fontWeight: 800,
      fontSize: 64,
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      lineHeight: 1.3,
    }}
  >
    FLOW CLIP PENDING
    <br />
    {`shot_${pad2(id)}.mp4`}
  </AbsoluteFill>
);
