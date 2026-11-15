// Single-Canvas Remotion Composition for Shorts-Studio v2.
// Avoids dual-ThreeCanvas XFADE memory spikes (halving VRAM/RAM on software GL & mobile CLI);
// post chain runs InkPass -> LensBlur Pre -> LensBlur Main -> HDR Bloom -> Neutral ToneMap -> 5-Mode GradeEffect,
// topped by optional crisp DOM <PopCaptions>.
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
import { PopCaptions, WordItem } from "../core/OverlayLayer";
import { SHOTS, TOTAL, shotAt, dofAt } from "./story";

export const SHADOW_FRAMES = TOTAL;

type InputProps = {
  shotId?: number;       // Optional override when rendering a single shot with +xfade handle
  captions?: boolean;
  words?: WordItem[];
  dpr?: number;
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
  gradeFor(fx.grade, SHOTS[shotId - 1].light); // the rendered shot, so xfade tail handles keep their own grade

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

export const ShadowWalkedAway: React.FC = () => {
  const f = useCurrentFrame();
  const props = getInputProps() as InputProps;
  const activeShot = props.shotId ? { id: props.shotId } : shotAt(f);

  return (
    <AbsoluteFill style={{ backgroundColor: "#141826" }}>
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
      <PopCaptions words={props.words ?? []} enabled={!!props.captions} />
    </AbsoluteFill>
  );
};
