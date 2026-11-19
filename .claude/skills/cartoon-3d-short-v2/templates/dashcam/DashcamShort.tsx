// Single-Canvas Remotion Composition for Shorts-Studio v2.
// Avoids dual-ThreeCanvas XFADE memory spikes (halving VRAM/RAM on software GL & mobile CLI);
// post chain runs InkPass -> LensBlur Pre -> LensBlur Main -> HDR Bloom -> Neutral ToneMap -> 5-Mode GradeEffect,
// topped by crisp DOM <DashcamHUD> and optional <PopCaptions>.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { MultiSetWorld } from "./sets";
import { InkPass, noInkFallback } from "../core/ink";
import { LensBlur } from "../core/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "../core/grade";
import { DashcamHUD, PopCaptions, WordItem } from "../core/OverlayLayer";
import { FlowClipLayer, isFlowShot } from "../core/FlowClip";
import { SHOTS, TOTAL, shotAt, dofAt, dashcamMph } from "./story";

export const DASHCAM_FRAMES = TOTAL;

type InputProps = {
  shotId?: number;       // Optional override when rendering a single shot with +xfade handle
  captions?: boolean;
  words?: WordItem[];
  dpr?: number;
  flowClips?: Record<string, string>; // shot id -> conformed public/ clip path of an ACCEPTED Flow take (set by render.mjs)
  flowPending?: number[]; // render.mjs --allow-missing-flow: Flow shots whose clip isn't downloaded yet (slate)
  forceThree?: boolean;  // render.mjs `refs`: draw a flow_clip shot's Three.js set to make Flow keyframes
  noOverlay?: boolean;   // render.mjs `refs`: clean frame without HUD
};

const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.5,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
    levels: 6,
    radius: 0.6,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const SceneInner: React.FC<{ shotId: number }> = ({ shotId }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new MultiSetWorld(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);

  useEffect(() => () => { fx.ink.dispose(); fx.lens.dispose(); }, [fx]);

  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(shotId, f, cam, scene));
  noInkFallback(world.root);

  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, shotAt(f).light);

  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </EffectComposer>
    </>
  );
};

export const DashcamShort: React.FC = () => {
  const f = useCurrentFrame();
  const props = getInputProps() as InputProps;
  const activeShot = props.shotId ? { ...(SHOTS.find((s) => s.id === props.shotId) ?? shotAt(f)), hud: shotAt(f).hud } : shotAt(f);
  // style-locked-flow: a flow_clip shot plays Flow footage ONLY when render.mjs passed an accepted, conformed take
  // (or a pending slate). Rejected/morphed takes, fast 1-2 s beats and dialogue/prop beats get no entry, so they
  // render from this same clean Three.js scene. Flow shots unmount the WebGL canvas; captions & HUD layer on top.
  const flowSrc = props.flowClips?.[String(activeShot.id)];
  const flow = isFlowShot(activeShot) && !props.forceThree && (!!flowSrc || !!props.flowPending?.includes(activeShot.id));

  return (
    <AbsoluteFill style={{ backgroundColor: "#1b2838" }}>
      {flow ? (
        <FlowClipLayer shot={activeShot} src={flowSrc} />
      ) : (
      <ThreeCanvas
        width={1080}
        height={1920}
        {...(props.dpr ? { dpr: props.dpr } : {})}
        shadows
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.15, far: 1200 }}
      >
        <SceneInner shotId={activeShot.id} />
      </ThreeCanvas>
      )}
      {!props.noOverlay && activeShot.hud === "dashcam" && f < 1790 && <DashcamHUD mph={dashcamMph(f)} />}
      <PopCaptions words={props.words ?? []} enabled={!!props.captions} />
    </AbsoluteFill>
  );
};
