// Single-Canvas Remotion Composition for Shorts-Studio v2.
// Avoids dual-ThreeCanvas XFADE memory spikes (halving VRAM/RAM on software GL & mobile CLI);
// post chain runs InkPass -> LensBlur Pre -> LensBlur Main -> HDR Bloom -> Neutral ToneMap -> 5-Mode GradeEffect,
// topped by the test-run <DiegeticHUD> (shot 22) and optional <PopCaptions>.
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
import { DiegeticHUD, PopCaptions, WordItem } from "../core/OverlayLayer";
import { FPS, TOTAL, shotAt, dofAt } from "./story";

export const CIGARETTE_FRAMES = TOTAL;

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

/** In-world machine tally for the test-run POV: rate first, then the per-day projection on "a day" */
const OutputReadout: React.FC<{ f: number }> = ({ f }) => {
  const made = Math.max(0, Math.floor((f - 1530) / 3) + 1);
  const perDay = f >= 1645;
  const pop = Math.min(1, Math.max(0, (f - 1645) / 4));
  return (
    <div style={{ position: "absolute", left: 78, top: 210, fontFamily: "'Courier New', monospace", color: "#c8ffd8",
      textShadow: "0 0 8px rgba(80,255,140,0.5)", fontWeight: 700 }}>
      <div style={{ fontSize: 34, opacity: 0.85 }}>OUTPUT</div>
      <div style={{ fontSize: 64 }}>{String(made).padStart(4, "0")}</div>
      <div style={{ fontSize: 36, marginTop: 6 }}>RATE 200 / MIN</div>
      {perDay && <div style={{ fontSize: 44, marginTop: 10, color: "#ffe9a8", transform: `scale(${0.9 + 0.1 * pop})`, transformOrigin: "left center" }}>≈ 120,000 / DAY</div>}
    </div>
  );
};
void FPS;

export const CigaretteShort: React.FC = () => {
  const f = useCurrentFrame();
  const props = getInputProps() as InputProps;
  const activeId = props.shotId ?? shotAt(f).id;

  return (
    <AbsoluteFill style={{ backgroundColor: "#1d1a18" }}>
      <ThreeCanvas
        width={1080}
        height={1920}
        {...(props.dpr ? { dpr: props.dpr } : {})}
        shadows
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.15, far: 1200 }}
      >
        <SceneInner shotId={activeId} />
      </ThreeCanvas>
      <DiegeticHUD enabled={shotAt(f).hud === "testrun"} mode="cctv" cameraLabel="TEST RUN · MACHINE No. 1"
        dateText="1881/03/08" startTime="21:14:05" showSpeed={false} />
      {shotAt(f).hud === "testrun" && <OutputReadout f={f} />}
      <PopCaptions words={props.words ?? []} enabled={!!props.captions} />
    </AbsoluteFill>
  );
};
