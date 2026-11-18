// Click-bait thumbnail for "What If You Fell Into a Black Hole?": one still rendered from the same 3D world
// (shocked astronaut close-up, black hole + glowing disk behind him) with bold DOM title type on top.
// Two compositions: BlackHoleThumb (1080x1920 Shorts) and BlackHoleThumbWide (1280x720 YouTube).
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { BlackHoleWorld } from "./sets";
import { InkPass, noInkFallback } from "../core/ink";
import { LensBlur } from "../core/lensblur";
import { GradeEffect, GRADES, gradeFor } from "../core/grade";
import { astroPos, Cam, V3 } from "./story";

const F = 236; // shot 2 (space, night) supplies the lighting / disk / sky state

const Scene: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { camera, scene } = useThree();
  const world = useMemo(() => new BlackHoleWorld(), []);
  const fx = useMemo(() => {
    const bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.65, luminanceThreshold: 1.0,
      luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.65 });
    return {
      ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
      lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
      bloom,
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      grade: new GradeEffect(GRADES.night, 1),
    };
  }, [camera, scene]);
  useEffect(() => () => { fx.ink.dispose(); fx.lens.dispose(); }, [fx]);

  const a = astroPos(F);
  const head: V3 = [a[0], a[1] + 1.42, a[2]];
  const cam: Cam = wide
    ? { pos: [head[0] + 0.3, head[1] - 0.15, head[2] + 2.5], look: [head[0] + 0.62, head[1] + 0.05, head[2]], fov: 44, roll: -0.03 }
    : { pos: [head[0] + 0.1, head[1] - 0.25, head[2] + 2.6], look: [head[0] - 0.05, head[1] + 1.2, head[2] - 8], fov: 56, roll: 0.04 };
  const c = camera as THREE.PerspectiveCamera;
  world.update(2, F, c, scene, cam);
  // shocked "uh-oh" pose, gloves up beside the helmet, facing the lens
  const yaw = Math.atan2(cam.pos[0] - a[0], cam.pos[2] - a[2]);
  world.astro.pose({ pos: a, yaw, expr: "shock", headPitch: -0.12, headYaw: 0.05, mouthOpen: 0.9,
    handL: [-0.38, 1.5, 0.26], handR: [0.38, 1.52, 0.26], footL: [-0.16, 0.12, 0.14], footR: [0.15, 0.07, 0.06] });
  world.astro.root.rotation.z = 0.08;
  noInkFallback(world.root);

  fx.lens.focus = Math.hypot(cam.pos[0] - head[0], cam.pos[1] - head[1], cam.pos[2] - head[2]);
  fx.lens.cInf = 9;
  gradeFor(fx.grade, "night");

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

const font = "'DejaVu Sans', Inter, Montserrat, sans-serif";
const Txt: React.FC<{ size: number; color: string; stroke: number; children: React.ReactNode; rot?: number; style?: React.CSSProperties }> =
  ({ size, color, stroke, children, rot = 0, style }) => (
    <div style={{ fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 0.95, color, letterSpacing: "-0.02em",
      WebkitTextStroke: `${stroke}px #0b0a0c`, paintOrder: "stroke fill", transform: `rotate(${rot}deg)`,
      filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.6))", textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );

export const BlackHoleThumb: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#04060c" }}>
    <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false }} camera={{ fov: 40, near: 0.1, far: 1200 }}>
      <Scene wide={false} />
    </ThreeCanvas>
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.5) 100%)" }} />
    <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <Txt size={76} color="#ffffff" stroke={14}>You'd die</Txt>
      <Txt size={210} color="#ffd23f" stroke={26} rot={-3}>Twice</Txt>
    </div>
    <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ background: "#e8322b", borderRadius: 26, padding: "14px 34px", transform: "rotate(-2deg)", border: "8px solid #0b0a0c",
        boxShadow: "0 12px 24px rgba(0,0,0,0.5)" }}>
        <Txt size={70} color="#ffffff" stroke={0} style={{ filter: "none" }}>…and both are true</Txt>
      </div>
    </div>
  </AbsoluteFill>
);

export const BlackHoleThumbWide: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#04060c" }}>
    <ThreeCanvas width={1280} height={720} shadows gl={{ antialias: false, stencil: false }} camera={{ fov: 40, near: 0.1, far: 1200 }}>
      <Scene wide />
    </ThreeCanvas>
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)" }} />
    <div style={{ position: "absolute", top: 96, right: 40, width: 620, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <Txt size={58} color="#ffffff" stroke={11}>You'd die</Txt>
      <Txt size={176} color="#ffd23f" stroke={20} rot={-3}>Twice</Txt>
      <div style={{ marginTop: 22, background: "#e8322b", borderRadius: 18, padding: "8px 24px", transform: "rotate(-2deg)", border: "6px solid #0b0a0c" }}>
        <Txt size={44} color="#ffffff" stroke={0} style={{ filter: "none", whiteSpace: "nowrap" }}>…and both are true</Txt>
      </div>
    </div>
  </AbsoluteFill>
);
