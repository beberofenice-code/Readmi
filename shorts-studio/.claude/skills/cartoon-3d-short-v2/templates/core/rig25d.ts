// Hybrid 2.5D Hero Rig for seated / vehicle / desk interactions without billboard clipping.
// Combines a 3D lathed bean-head + 3D tapered capsule torso (with crisp BackSide black-ink outline shells on NOINK)
// + pooled Canvas2D facial expressions + frame-driven expression state machine + swappable 3D accessories
// (sunglasses, hats, coffee cup, smartphone) + comedic visual accents (animated sweat drop, radial motion lines)
// + 3D CatmullRom TubeGeometry capsule stick limbs that reach 3D targets (pedals, wheels, phones).
import * as THREE from "three";
import { INK, SKIN, Pen, Expr } from "./toon";
import { cardShade } from "./cardshade";
import { NOINK } from "./ink";

export type HatKind = "none" | "police" | "baseball" | "beanie" | "hard_hat" | "tophat";
export type MotionLineKind = "shock" | "speed" | "panic";

/** The 7 signature cinema emotional states for rapid frame-driven swaps */
export type ExpressionKey =
  | "smug"
  | "panicked"
  | "fake_pain"
  | "shocked_sweat"
  | "deadpan"
  | "annoyed"
  | "triumphant";

export type ExpressionKeyframe = {
  frame: number;
  expr: Expr;
  sweatDrop?: boolean;
  motionLines?: boolean | MotionLineKind;
  headPitch?: number;
  headYaw?: number;
};

export type ExpressionState = {
  expr: Expr;
  blink: number;
  sweatDrop: boolean;
  motionLines: false | MotionLineKind;
  ageFrames: number;
  headPitchDelta: number;
  headYawDelta: number;
  /** Subtle head vertical pop on an expression swap (1.0 at rest, brief 1.07 pop for 3 frames) */
  squashY: number;
};

/** Deterministic natural blink (returns 0 open, 0.5 half-lid, 1 closed) every ~2.8-4.2 seconds. */
export const autoBlink = (frame: number, seed = 1): number => {
  const period = 84 + ((Math.abs(Math.floor(seed * 37)) % 5) * 11);
  const offset = Math.abs(Math.floor(seed * 53)) % period;
  const phase = (Math.floor(frame) + offset) % period;
  if (phase === 1 || phase === 2) return 1;
  if (phase === 0 || phase === 3) return 0.5;
  return 0;
};

const WIDE_EYE_EXPRS = new Set<Expr>(["shock", "panicked", "shocked_sweat", "dazed", "fake_pain", "pained"]);

/**
 * Frame-driven facial expression state machine for rapid emotional swaps.
 * Evaluates the latest keyframe at or before `frame`, derives natural blink, comedic accents
 * (sweat drop, motion lines), and a subtle 4-frame reaction head pop on state transitions.
 */
export const resolveExpression = (
  keyframes: ExpressionKeyframe[],
  frame: number,
  seed = 1,
): ExpressionState => {
  if (!keyframes.length) {
    return {
      expr: "neutral",
      blink: autoBlink(frame, seed),
      sweatDrop: false,
      motionLines: false,
      ageFrames: Math.max(0, frame),
      headPitchDelta: 0,
      headYawDelta: 0,
      squashY: 1,
    };
  }
  let active = keyframes[0];
  for (let i = 0; i < keyframes.length; i++) {
    if (keyframes[i].frame <= frame) active = keyframes[i];
    else break;
  }
  const age = Math.max(0, frame - active.frame);
  const expr = active.expr;
  const blink = WIDE_EYE_EXPRS.has(expr) ? 0 : autoBlink(frame, seed);
  const sweatDrop =
    active.sweatDrop !== undefined
      ? active.sweatDrop
      : expr === "shocked_sweat" || expr === "panicked" || expr === "nervous";

  let motionLines: false | MotionLineKind = false;
  if (active.motionLines === true) {
    motionLines = expr === "panicked" ? "panic" : "shock";
  } else if (typeof active.motionLines === "string") {
    motionLines = active.motionLines;
  } else if ((expr === "panicked" || expr === "shock" || expr === "shocked_sweat") && age < 14) {
    motionLines = expr === "panicked" ? "panic" : "shock";
  }

  // Crisp 4-frame spring accent on rapid expression swap
  const squashY = age < 4 ? 1 + 0.065 * Math.sin((age / 4) * Math.PI) : 1;

  return {
    expr,
    blink,
    sweatDrop,
    motionLines,
    ageFrames: age,
    headPitchDelta: active.headPitch ?? 0,
    headYawDelta: active.headYaw ?? 0,
    squashY,
  };
};

export type RigPose = {
  pos: [number, number, number];
  yaw?: number;
  lean?: number;
  headYaw?: number;
  headPitch?: number;
  expr?: Expr;
  mouthOpen?: number; // 0..1 from voice/mouth_env.json
  blink?: number;     // 0, 0.5, 1
  handL?: [number, number, number]; // local target relative to rig root
  handR?: [number, number, number];
  footL?: [number, number, number];
  footR?: [number, number, number];
  brace?: boolean;    // foam neck brace (scammer after his "injury")
  cap?: boolean;      // police cap (trooper; backward-compatible alias for hat: "police")
  hat?: HatKind;      // swappable per-frame hat override
  shades?: boolean;   // swappable per-frame sunglasses override
  coffeeCup?: "L" | "R" | false; // swappable coffee cup attached to a hand
  phone?: "L" | "R" | false;     // swappable smartphone attached to a hand
  sweatDrop?: boolean;           // animated cartoon sweat drop on temple
  motionLines?: boolean | MotionLineKind; // radial shock/speed/panic ink lines behind head
  frame?: number;                // current animation frame (for sweat drop slide, steam, motion lines)
  exprState?: ExpressionState;   // optional output from resolveExpression()
  armsFollowLean?: boolean;      // shoulders follow the torso lean (lying in bed, deep crouch); default keeps them upright
};

const BOLD_INK = "#140e17";
const defaultOutlineMat = new THREE.MeshBasicMaterial({ color: BOLD_INK, side: THREE.BackSide });
const limbMat = new THREE.MeshBasicMaterial({ color: BOLD_INK });

/** cardShade samples `map`, so flat-coloured rig parts need a 1-colour texture (an untextured material renders black) */
const solid = (hex: string) => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 4;
  const g = cv.getContext("2d")!;
  g.fillStyle = hex; g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return cardShade(new THREE.MeshLambertMaterial({ map: t }));
};

const addPlumHull = (mesh: THREE.Mesh, thickness = 1.06, mat: THREE.Material = defaultOutlineMat) => {
  const hull = new THREE.Mesh(mesh.geometry, mat);
  hull.scale.setScalar(thickness);
  hull.layers.set(NOINK);
  mesh.add(hull);
  return hull;
};

/** deterministic 0..1 sequence (stable across renders / chunks) */
const seeded = (seed: number) => {
  let s = Math.floor(seed * 7919 + 104729) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

/** survival grime: ketchup splats with drips, coffee-ground speckles, stuck-on bandage strips. k scales to the canvas. */
const grime = (g: CanvasRenderingContext2D, R: () => number, size: number, k: number, nSplat = 5, nBand = 2) => {
  for (let i = 0; i < nSplat; i++) {
    const x = R() * size, y = size * (0.15 + R() * 0.7), r = (10 + R() * 16) * k;
    g.fillStyle = "#c8262c";
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    for (let d = 0; d < 4; d++) { const a = R() * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4, r * 0.3, 0, Math.PI * 2); g.fill(); }
    g.fillRect(x - r * 0.18, y, r * 0.36, r * (1.2 + R() * 1.4)); // drip
  }
  g.fillStyle = "#4a3222";
  for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(R() * size, R() * size, (1.5 + R() * 2.5) * k, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < nBand; i++) {
    g.save();
    g.translate(size * (0.2 + R() * 0.6), size * (0.2 + R() * 0.6)); g.rotate((R() - 0.5) * 1.6);
    g.fillStyle = "#efe6cf"; g.fillRect(-46 * k, -11 * k, 92 * k, 22 * k);
    g.strokeStyle = "rgba(150,120,90,0.6)"; g.lineWidth = 2 * k;
    for (let x = -40; x <= 40; x += 10) { g.beginPath(); g.moveTo(x * k, -11 * k); g.lineTo((x + 6) * k, 11 * k); g.stroke(); }
    g.fillStyle = "rgba(200,60,50,0.55)"; g.beginPath(); g.arc(0, 0, 7 * k, 0, Math.PI * 2); g.fill();
    g.restore();
  }
};

export type RigStyle = {
  skin?: string;
  jacket: string;
  collar?: string;          // crisp folded dress/polo collar at the neckline (e.g., "#ffffff")
  vest?: string;            // e.g., "#e8d238" yellow vest for the brake-check scammer
  tie?: string;             // necktie color (auto-draws crisp white collar & knot)
  apron?: string;           // shop/barista apron overlay
  hair?: string;
  shades?: boolean;         // dark sunglasses with bold outline frames
  hat?: HatKind;            // default hat on the rig ("police" | "baseball" | "beanie" | "hard_hat" | "tophat")
  hatColor?: string;        // override color for baseball/beanie/hard_hat
  coffeeCup?: "L" | "R" | false; // default held coffee cup
  phone?: "L" | "R" | false;     // default held smartphone
  stripes?: string;         // horizontal pajama stripes over the jacket colour
  torn?: boolean;           // ripped shirt with skin showing through the tears (zombies)
  zombie?: boolean;         // blank white eyes with pin pupils, eye bags, stitched cheek, crooked open mouth
  grime?: boolean;          // ketchup splats, coffee-ground smudges and stuck-on bandages (torso + face)
  seed?: number;            // varies tears / splats between cast members
  bib?: string;             // pinned race-bib number on the chest (charity-walk entrants)
  outlineColor?: string;    // bold outline hull color (default "#140e17")
  outlineThickness?: number;// head/torso BackSide hull scale (default 1.062)
};

export class HeroRig25D {
  root = new THREE.Group();
  torsoPivot = new THREE.Group();
  headPivot = new THREE.Group();
  private headMesh: THREE.Mesh;
  private faceCanvas: HTMLCanvasElement;
  private faceTex: THREE.CanvasTexture;
  private lastFaceKey = "";
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private handSphereL: THREE.Mesh;
  private handSphereR: THREE.Mesh;
  private bootL: THREE.Mesh;
  private bootR: THREE.Mesh;
  private brace: THREE.Mesh;
  private hats: Record<Exclude<HatKind, "none">, THREE.Group>;
  private shades3D: THREE.Group;
  private coffeeCupProp: THREE.Group;
  private coffeeSteam: THREE.Mesh[];
  private phoneProp: THREE.Group;
  private sweatDrop3D: THREE.Group;
  private motionLines3D: THREE.Group;
  private outlineMat: THREE.MeshBasicMaterial;

  constructor(parent: THREE.Object3D, public style: RigStyle) {
    this.outlineMat = style.outlineColor
      ? new THREE.MeshBasicMaterial({ color: style.outlineColor, side: THREE.BackSide })
      : defaultOutlineMat;
    const thick = style.outlineThickness ?? 1.062;

    this.root.add(this.torsoPivot);
    this.torsoPivot.position.set(0, 0.72, 0);
    this.headPivot.position.set(0, 0.52, 0);
    this.torsoPivot.add(this.headPivot);

    // 1. 3D Bean Torso + Bold Black Outline Hull
    const torsoGeo = new THREE.CapsuleGeometry(0.19, 0.30, 10, 18);
    // Texture u=0.5 (vest opening / face centre) lands on local +x by default; the rig's limbs and every pose
    // treat local +z as "forward", so turn the textured shells to face +z.
    torsoGeo.rotateY(-Math.PI / 2);
    const torsoTex = this.makeTorsoTexture(style);
    const torsoMat = cardShade(new THREE.MeshLambertMaterial({ map: torsoTex }));
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.set(0, 0.24, 0);
    torsoMesh.layers.set(NOINK);
    addPlumHull(torsoMesh, thick, this.outlineMat);
    this.torsoPivot.add(torsoMesh);

    // 2. 3D Superellipse Bean Head + Dynamic 2D Face Decal + Crisp Bold Outline
    this.faceCanvas = document.createElement("canvas");
    this.faceCanvas.width = 512;
    this.faceCanvas.height = 512;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;

    const headGeo = new THREE.SphereGeometry(0.22, 24, 20);
    headGeo.scale(1.06, 0.98, 0.92); // H/W ~0.93 wider-than-tall reference proportion
    headGeo.rotateY(-Math.PI / 2);   // face decal forward (+z), matching limbs and poses
    const headMat = cardShade(new THREE.MeshLambertMaterial({ map: this.faceTex }));
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.set(0, 0.20, 0);
    this.headMesh.layers.set(NOINK);
    addPlumHull(this.headMesh, thick, this.outlineMat);
    this.headPivot.add(this.headMesh);

    // 3. 3D Spline Capsule Stick Limbs + Ink-Dot Hands
    const dummyTube = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, -0.3, 0)), 8, 0.022, 6, false);
    this.armL = new THREE.Mesh(dummyTube.clone(), limbMat);
    this.armR = new THREE.Mesh(dummyTube.clone(), limbMat);
    this.legL = new THREE.Mesh(dummyTube.clone(), limbMat);
    this.legR = new THREE.Mesh(dummyTube.clone(), limbMat);
    const dotGeo = new THREE.SphereGeometry(0.036, 10, 8);
    this.handSphereL = new THREE.Mesh(dotGeo, limbMat);
    this.handSphereR = new THREE.Mesh(dotGeo, limbMat);

    // 4. Boots (rounded toe-forward blobs at the foot targets)
    const bootGeo = new THREE.SphereGeometry(0.06, 14, 10);
    bootGeo.scale(1.0, 0.75, 1.9);
    const bootMat = solid("#a8703f");
    this.bootL = new THREE.Mesh(bootGeo, bootMat);
    this.bootR = new THREE.Mesh(bootGeo, bootMat);
    for (const b of [this.bootL, this.bootR]) { addPlumHull(b, 1.07, this.outlineMat); b.layers.set(NOINK); this.root.add(b); }

    // 5. Foam neck brace (ring between torso and head)
    const braceGeo = new THREE.CylinderGeometry(0.155, 0.17, 0.13, 20);
    this.brace = new THREE.Mesh(braceGeo, solid("#f2ede1"));
    this.brace.position.set(0, 0.54, 0);
    this.brace.layers.set(NOINK);
    addPlumHull(this.brace, 1.06, this.outlineMat);
    this.brace.visible = false;
    this.torsoPivot.add(this.brace);

    // 6. Swappable 3D Hats (all on NOINK, attached to headPivot)
    this.hats = this.buildHats(style.hatColor);
    for (const h of Object.values(this.hats)) {
      h.visible = false;
      this.headPivot.add(h);
    }

    // 7. Swappable 3D Outlined Sunglasses (sits cleanly over the face on +z)
    this.shades3D = this.buildShades();
    this.shades3D.visible = false;
    this.headPivot.add(this.shades3D);

    // 8. Swappable 3D Travel Coffee Cup (with sleeve, lid, and rising steam wisps)
    const { group: cupGroup, steam } = this.buildCoffeeCup();
    this.coffeeCupProp = cupGroup;
    this.coffeeSteam = steam;
    this.coffeeCupProp.visible = false;
    this.root.add(this.coffeeCupProp);

    // 9. Swappable 3D Smartphone Prop
    this.phoneProp = this.buildPhone();
    this.phoneProp.visible = false;
    this.root.add(this.phoneProp);

    // 10. Animated 3D Comedic Sweat Drop (slides along temple on shocked_sweat / panicked)
    this.sweatDrop3D = this.buildSweatDrop();
    this.sweatDrop3D.visible = false;
    this.headPivot.add(this.sweatDrop3D);

    // 11. Animated 3D Radial Motion Lines behind head (shock / panic / speed bursts)
    this.motionLines3D = this.buildMotionLines();
    this.motionLines3D.visible = false;
    this.headPivot.add(this.motionLines3D);

    for (const m of [this.armL, this.armR, this.legL, this.legR, this.handSphereL, this.handSphereR]) {
      m.layers.set(NOINK);
      this.root.add(m);
    }
    parent.add(this.root);
  }

  private buildHats(customColor?: string): Record<Exclude<HatKind, "none">, THREE.Group> {
    const tagNoInk = (g: THREE.Object3D) => {
      g.traverse((o) => { o.layers.set(NOINK); });
      return g as THREE.Group;
    };

    // Police cap
    const police = new THREE.Group();
    const capMat = solid(customColor ?? "#2a3a63");
    const pCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.20, 0.13, 22), capMat);
    pCrown.position.set(0, 0.38, -0.01);
    addPlumHull(pCrown, 1.06, this.outlineMat);
    const pBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 18, 1, false, -Math.PI / 2, Math.PI), solid("#181e2c"));
    pBrim.scale.set(1, 1, 0.85);
    pBrim.position.set(0, 0.33, 0.13);
    const pBadge = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: "#e8c45a" }));
    pBadge.position.set(0, 0.39, 0.205);
    police.add(pCrown, pBrim, pBadge);

    // Baseball cap
    const baseball = new THREE.Group();
    const bMat = solid(customColor ?? "#d94338");
    const bDome = new THREE.Mesh(new THREE.SphereGeometry(0.228, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), bMat);
    bDome.scale.set(1.06, 0.96, 0.95);
    bDome.position.set(0, 0.215, 0);
    addPlumHull(bDome, 1.055, this.outlineMat);
    const bPeak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.024, 0.18), solid(customColor ?? "#b5332a"));
    bPeak.position.set(0, 0.30, 0.21);
    bPeak.rotation.x = 0.08;
    addPlumHull(bPeak, 1.08, this.outlineMat);
    const bBtn = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), solid("#f2efe6"));
    bBtn.position.set(0, 0.435, 0);
    baseball.add(bDome, bPeak, bBtn);

    // Knit beanie
    const beanie = new THREE.Group();
    const kMat = solid(customColor ?? "#2f5f7a");
    const kDome = new THREE.Mesh(new THREE.SphereGeometry(0.232, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), kMat);
    kDome.scale.set(1.06, 1.06, 0.96);
    kDome.position.set(0, 0.22, -0.01);
    addPlumHull(kDome, 1.055, this.outlineMat);
    const kCuff = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.042, 10, 24), solid(customColor ?? "#244c63"));
    kCuff.rotation.x = Math.PI / 2;
    kCuff.scale.set(1.04, 0.94, 1);
    kCuff.position.set(0, 0.31, -0.005);
    addPlumHull(kCuff, 1.06, this.outlineMat);
    const kPom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), solid("#f0ebe1"));
    kPom.position.set(0, 0.47, -0.01);
    addPlumHull(kPom, 1.08, this.outlineMat);
    beanie.add(kDome, kCuff, kPom);

    // Construction hard hat
    const hard_hat = new THREE.Group();
    const hMat = solid(customColor ?? "#f4c830");
    const hDome = new THREE.Mesh(new THREE.SphereGeometry(0.236, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.54), hMat);
    hDome.scale.set(1.08, 0.98, 1.0);
    hDome.position.set(0, 0.22, 0);
    addPlumHull(hDome, 1.055, this.outlineMat);
    const hRidge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.38), hMat);
    hRidge.position.set(0, 0.44, 0);
    addPlumHull(hRidge, 1.08, this.outlineMat);
    const hBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.275, 0.022, 24), hMat);
    hBrim.scale.set(1.06, 1, 1.12);
    hBrim.position.set(0, 0.295, 0.02);
    addPlumHull(hBrim, 1.05, this.outlineMat);
    hard_hat.add(hDome, hRidge, hBrim);

    // Top hat (wealth / scammer victory gag)
    const tophat = new THREE.Group();
    const tMat = solid(customColor ?? "#25222c");
    const tBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.024, 24), tMat);
    tBrim.position.set(0, 0.35, 0);
    addPlumHull(tBrim, 1.05, this.outlineMat);
    const tCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.185, 0.30, 22), tMat);
    tCrown.position.set(0, 0.50, 0);
    addPlumHull(tCrown, 1.055, this.outlineMat);
    const tBand = new THREE.Mesh(new THREE.CylinderGeometry(0.192, 0.190, 0.055, 22), solid("#d43a3a"));
    tBand.position.set(0, 0.39, 0);
    tophat.add(tBrim, tCrown, tBand);

    return {
      police: tagNoInk(police),
      baseball: tagNoInk(baseball),
      beanie: tagNoInk(beanie),
      hard_hat: tagNoInk(hard_hat),
      tophat: tagNoInk(tophat),
    };
  }

  private buildShades(): THREE.Group {
    const g = new THREE.Group();
    const lensMat = new THREE.MeshBasicMaterial({ color: "#14131c" });
    const frameMat = new THREE.MeshBasicMaterial({ color: "#e8c45a" });
    const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.42 });
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.072, 0.024), lensMat);
      lens.position.set(side * 0.074, 0.21, 0.21);
      addPlumHull(lens, 1.12, this.outlineMat);
      const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.058), glintMat);
      glint.position.set(side * 0.074 - 0.02, 0.21, 0.224);
      glint.rotation.z = -0.35;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.18), frameMat);
      arm.position.set(side * 0.145, 0.225, 0.12);
      g.add(lens, glint, arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.016, 0.018), frameMat);
    bridge.position.set(0, 0.222, 0.21);
    g.add(bridge);
    g.traverse((o) => { o.layers.set(NOINK); });
    return g;
  }

  private buildCoffeeCup(): { group: THREE.Group; steam: THREE.Mesh[] } {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.135, 14), solid("#f6f2e8"));
    addPlumHull(body, 1.09, this.outlineMat);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.041, 0.058, 14), solid("#b8824c"));
    sleeve.position.y = -0.005;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.050, 0.022, 14), solid("#2b2930"));
    lid.position.y = 0.074;
    addPlumHull(lid, 1.08, this.outlineMat);
    g.add(body, sleeve, lid);

    const steam: THREE.Mesh[] = [];
    const steamMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.65, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.018 - i * 0.002, 8, 6), steamMat.clone());
      puff.position.set((i - 1) * 0.015, 0.11 + i * 0.045, 0);
      g.add(puff);
      steam.push(puff);
    }
    g.traverse((o) => { o.layers.set(NOINK); });
    return { group: g, steam };
  }

  private buildPhone(): THREE.Group {
    const g = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.132, 0.014), solid("#222530"));
    addPlumHull(chassis, 1.12, this.outlineMat);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.058, 0.112),
      new THREE.MeshBasicMaterial({ color: "#76d4ff" }),
    );
    screen.position.z = 0.008;
    g.add(chassis, screen);
    g.traverse((o) => { o.layers.set(NOINK); });
    return g;
  }

  private buildSweatDrop(): THREE.Group {
    const g = new THREE.Group();
    const dropMat = new THREE.MeshBasicMaterial({ color: "#6fd4ff" });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), dropMat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.055, 12), dropMat);
    tip.position.y = 0.036;
    const spec = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    spec.position.set(-0.008, 0.004, 0.024);
    addPlumHull(bulb, 1.16, this.outlineMat);
    addPlumHull(tip, 1.16, this.outlineMat);
    g.add(bulb, tip, spec);
    g.position.set(0.245, 0.27, 0.08);
    g.traverse((o) => { o.layers.set(NOINK); });
    return g;
  }

  private buildMotionLines(): THREE.Group {
    const g = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: BOLD_INK });
    const count = 8;
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 1.3;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.11 + (i % 2) * 0.04, 0.01), lineMat);
      const r = 0.34;
      bar.position.set(Math.cos(ang) * r, 0.22 + Math.sin(ang) * r * 0.9, -0.06);
      bar.rotation.z = ang - Math.PI / 2;
      g.add(bar);
    }
    g.traverse((o) => { o.layers.set(NOINK); });
    return g;
  }

  private makeTorsoTexture(st: RigStyle): THREE.CanvasTexture {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 256;
    const g = cv.getContext("2d")!;
    g.fillStyle = st.jacket;
    g.fillRect(0, 0, 256, 256);

    if (st.vest) {
      g.fillStyle = st.vest;
      g.fillRect(0, 30, 104, 204);
      g.fillRect(152, 30, 104, 204);
      g.strokeStyle = BOLD_INK;
      g.lineWidth = 4;
      g.strokeRect(0, 30, 104, 204);
      g.strokeRect(152, 30, 104, 204);
      g.fillStyle = "#eef4f8"; // crisp reflective stripe
      g.fillRect(0, 148, 256, 18);
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.fillRect(0, 152, 256, 5);
    }

    if (st.apron) {
      g.fillStyle = st.apron;
      g.fillRect(78, 66, 100, 182);
      g.strokeStyle = BOLD_INK;
      g.lineWidth = 4;
      g.strokeRect(78, 66, 100, 182);
      // neck loop + front pocket
      g.fillStyle = st.apron;
      g.fillRect(96, 14, 12, 54);
      g.fillRect(148, 14, 12, 54);
      g.strokeRect(98, 148, 60, 44);
    }

    if (st.collar || st.tie) {
      const colFill = st.collar ?? "#ffffff";
      // Shirt placket triangle
      g.fillStyle = colFill;
      g.beginPath();
      g.moveTo(100, 14);
      g.lineTo(156, 14);
      g.lineTo(140, 134);
      g.lineTo(116, 134);
      g.closePath();
      g.fill();
      g.strokeStyle = BOLD_INK;
      g.lineWidth = 3.5;
      g.stroke();

      // Crisp folded left & right collar wings
      for (const s of [-1, 1]) {
        g.fillStyle = colFill;
        g.beginPath();
        g.moveTo(128, 24);
        g.lineTo(128 + s * 34, 16);
        g.lineTo(128 + s * 28, 52);
        g.closePath();
        g.fill();
        g.strokeStyle = BOLD_INK;
        g.lineWidth = 3.5;
        g.stroke();
      }
    }

    if (st.tie) {
      // Tie blade + Windsor knot with bold ink rim
      g.fillStyle = st.tie;
      g.strokeStyle = BOLD_INK;
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(128, 34);
      g.lineTo(142, 134);
      g.lineTo(128, 158);
      g.lineTo(114, 134);
      g.closePath();
      g.fill();
      g.stroke();
      // Knot
      g.beginPath();
      g.moveTo(118, 20);
      g.lineTo(138, 20);
      g.lineTo(134, 38);
      g.lineTo(122, 38);
      g.closePath();
      g.fill();
      g.stroke();
    }

    if (st.stripes) {
      g.fillStyle = st.stripes;
      for (let y = 18; y < 256; y += 34) g.fillRect(0, y, 256, 11);
      g.fillStyle = "#f4f1ea"; // pajama buttons down the front
      for (let y = 40; y < 220; y += 44) { g.beginPath(); g.arc(128, y, 6, 0, Math.PI * 2); g.fill(); }
    }
    const R = seeded(st.seed ?? 1);
    if (st.torn) {
      // ragged rips showing skin, each with a dark frayed rim; jagged hem along the bottom
      const skin = st.skin ?? SKIN;
      for (let k = 0; k < 4; k++) {
        const cx = 40 + R() * 176, cy = 50 + R() * 150, rx = 14 + R() * 18, ry = 10 + R() * 14;
        const pts: [number, number][] = [];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2, j = i % 2 ? 0.55 : 1.0;
          pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
        }
        const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
        path(); g.fillStyle = skin; g.fill();
        g.lineWidth = 5; g.strokeStyle = "rgba(36,23,38,0.75)"; g.stroke();
      }
      g.fillStyle = "rgba(60,40,30,0.28)"; // dirt smudges
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(R() * 256, R() * 256, 12 + R() * 20, 8 + R() * 12, R() * 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = skin;
      g.beginPath(); g.moveTo(0, 256);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, x % 32 ? 228 + R() * 10 : 248);
      g.lineTo(256, 256); g.closePath(); g.fill();
    }
    if (st.bib) {
      g.save(); g.translate(128, 150); g.rotate(-0.06);
      g.fillStyle = "#f7f7f2"; g.fillRect(-34, -24, 68, 48);
      g.strokeStyle = "#241726"; g.lineWidth = 3; g.strokeRect(-34, -24, 68, 48);
      g.fillStyle = "#d23a32"; g.fillRect(-34, -24, 68, 9);
      g.fillStyle = "#241726"; g.font = "bold 26px sans-serif"; g.textAlign = "center"; g.fillText(st.bib, 0, 16);
      g.fillStyle = "#b9b9b0"; for (const [x, y] of [[-29, -19], [29, -19], [-29, 19], [29, 19]]) { g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    if (st.grime) grime(g, R, 256, 1);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private redrawFace(expr: Expr, blink: number, mouthOpen: number, shadesOn: boolean, sweatOn: boolean, frame: number) {
    const sweatStep = sweatOn ? Math.floor(frame / 2) % 12 : 0;
    const key = `${expr}|${blink.toFixed(1)}|${Math.round(mouthOpen * 6)}|${shadesOn ? 1 : 0}|${sweatOn ? sweatStep : -1}`;
    if (key === this.lastFaceKey) return;
    this.lastFaceKey = key;
    const g = this.faceCanvas.getContext("2d")!;
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = this.style.skin ?? SKIN;
    g.fillRect(0, 0, 512, 512);

    if (this.style.hair) {
      g.fillStyle = this.style.hair;
      g.fillRect(0, 0, 512, 155);
      // Crisp ink hairline edge
      g.fillStyle = BOLD_INK;
      g.fillRect(0, 153, 512, 6);
    }

    const p = new Pen(g);
    const cy = 248, exL = 222, exR = 290;
    const zombie = !!this.style.zombie;
    if (zombie) {
      // sunken purple eye bags + a stitched scar on one cheek
      g.fillStyle = "rgba(90,50,110,0.45)";
      g.beginPath(); g.ellipse(exL, cy + 6, 26, 22, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(exR, cy + 6, 26, 22, 0, 0, Math.PI * 2); g.fill();
      const sx = (this.style.seed ?? 1) % 2 ? 318 : 186;
      p.stroke([[sx - 18, cy + 30], [sx + 18, cy + 50]], 5);
      for (let i = 0; i < 4; i++) { const x = sx - 14 + i * 10, y = cy + 33 + i * 5; p.stroke([[x - 4, y + 7], [x + 4, y - 7]], 4); }
    }

    // ---- Eyes ----
    if (shadesOn) {
      p.poly([[188, cy - 20], [250, cy - 20], [245, cy + 16], [194, cy + 16]], "#15141e", 7);
      p.poly([[262, cy - 20], [324, cy - 20], [318, cy + 16], [267, cy + 16]], "#15141e", 7);
      p.stroke([[250, cy - 10], [262, cy - 10]], 7, "#e8c45a");
      // Glint slashes
      p.stroke([[202, cy - 12], [216, cy + 8]], 5, "rgba(255,255,255,0.45)");
      p.stroke([[276, cy - 12], [290, cy + 8]], 5, "rgba(255,255,255,0.45)");
    } else if (blink >= 0.8) {
      p.stroke([[exL - 17, cy], [exL + 17, cy]], 9);
      p.stroke([[exR - 17, cy], [exR + 17, cy]], 9);
    } else if (zombie) {
      const big = expr === "shock" || expr === "panicked" ? 1.2 : 1;
      p.ell(exL, cy, 19 * big, 17 * big, "#f4f3e8", 6); p.dot(exL + 5, cy + 3, 4);
      p.ell(exR, cy - 2, 15 * big, 15 * big, "#f4f3e8", 6); p.dot(exR - 3, cy - 4, 4);
    } else if (expr === "shock" || expr === "panicked" || expr === "shocked_sweat") {
      const jitter = expr === "panicked" ? ((frame % 2) * 2 - 1) * 2.5 : 0;
      const radE = expr === "panicked" ? 23 : 21;
      const pupilR = expr === "panicked" ? 4.5 : 5.5;
      p.ell(exL, cy, radE, radE, "#ffffff", 7); p.dot(exL + jitter, cy + jitter * 0.5, pupilR, BOLD_INK);
      p.ell(exR, cy, radE, radE, "#ffffff", 7); p.dot(exR - jitter, cy - jitter * 0.5, pupilR, BOLD_INK);
    } else if (expr === "fake_pain") {
      // Left eye squeezed theatrical `>`, right eye slyly peeking slit
      p.stroke([[exL - 16, cy - 12], [exL + 12, cy], [exL - 16, cy + 12]], 9);
      p.ell(exR, cy + 2, 12, 6, BOLD_INK, 0, 0, 180);
      p.stroke([[exR - 18, cy + 2], [exR + 18, cy + 2]], 8);
    } else if (expr === "pained") {
      p.stroke([[exL - 14, cy - 10], [exL + 12, cy], [exL - 14, cy + 10]], 8);
      p.stroke([[exR + 14, cy - 10], [exR - 12, cy], [exR + 14, cy + 10]], 8);
    } else if (expr === "smug") {
      // Heavy-lidded asymmetric smug eyes
      p.ell(exL, cy + 3, 12, 7, BOLD_INK, 0, 0, 180);
      p.stroke([[exL - 18, cy + 2], [exL + 18, cy + 4]], 8);
      p.ell(exR, cy + 1, 13, 9, BOLD_INK, 0, 0, 180);
      p.stroke([[exR - 18, cy], [exR + 18, cy + 2]], 8);
    } else if (expr === "deadpan") {
      // Flat bored horizontal eyelids
      p.ell(exL, cy + 4, 12, 6, BOLD_INK, 0, 0, 180);
      p.stroke([[exL - 19, cy + 3], [exL + 19, cy + 3]], 9);
      p.ell(exR, cy + 4, 12, 6, BOLD_INK, 0, 0, 180);
      p.stroke([[exR - 19, cy + 3], [exR + 19, cy + 3]], 9);
    } else if (expr === "annoyed") {
      // Half-lidded glaring eyes under angry angled upper lid
      p.ell(exL, cy + 4, 12, 8, BOLD_INK, 0, 0, 180);
      p.stroke([[exL - 18, cy - 2], [exL + 18, cy + 6]], 9);
      p.ell(exR, cy + 4, 12, 8, BOLD_INK, 0, 0, 180);
      p.stroke([[exR - 18, cy + 6], [exR + 18, cy - 2]], 9);
    } else if (expr === "triumphant" || expr === "laugh" || expr === "grin") {
      // Happy upward `^ ^` arcs
      p.arc(exL, cy + 8, 16, 13, 200, 340, 9);
      p.arc(exR, cy + 8, 16, 13, 200, 340, 9);
    } else {
      // Crisp cartoon lidded dots (classic stickman / bean-head)
      const hLid = blink >= 0.4 ? 5 : 10;
      p.ell(exL, cy, 12, hLid, BOLD_INK, 0, 0, 180); p.stroke([[exL - 16, cy], [exL + 16, cy]], 7.5);
      p.ell(exR, cy, 12, hLid, BOLD_INK, 0, 0, 180); p.stroke([[exR - 16, cy], [exR + 16, cy]], 7.5);
    }

    // ---- Brows ----
    if (expr === "smug") {
      // Left brow low/flat, right brow cocked high
      p.stroke([[exL - 19, cy - 28], [exL + 16, cy - 26]], 9);
      p.arc(exR, cy - 26, 18, 10, 205, 345, 9);
    } else if (expr === "panicked") {
      // Sharply raised inner worried brows
      p.stroke([[exL - 20, cy - 36], [exL + 14, cy - 52]], 9);
      p.stroke([[exR - 14, cy - 52], [exR + 20, cy - 36]], 9);
    } else if (expr === "shocked_sweat" || expr === "shock") {
      p.arc(exL, cy - 38, 18, 9, 200, 340, 9);
      p.arc(exR, cy - 38, 18, 9, 200, 340, 9);
    } else if (expr === "fake_pain") {
      p.stroke([[exL - 18, cy - 26], [exL + 14, cy - 42]], 9);
      p.stroke([[exR - 14, cy - 38], [exR + 18, cy - 26]], 9);
    } else if (expr === "deadpan") {
      p.stroke([[exL - 19, cy - 26], [exL + 17, cy - 26]], 9);
      p.stroke([[exR - 17, cy - 26], [exR + 19, cy - 26]], 9);
    } else if (expr === "annoyed" || expr === "stern") {
      p.stroke([[exL - 20, cy - 36], [exL + 18, cy - 18]], 10);
      p.stroke([[exR - 18, cy - 18], [exR + 20, cy - 36]], 10);
    } else if (expr === "triumphant") {
      p.arc(exL, cy - 34, 17, 10, 200, 340, 9);
      p.arc(exR, cy - 34, 17, 10, 200, 340, 9);
    } else {
      p.stroke([[exL - 18, cy - 32 + (zombie ? 6 : 0)], [exL + 16, cy - 34]], 9);
      p.stroke([[exR - 16, cy - 34], [exR + 18, cy - 32]], 9);
    }

    // ---- Mouth ----
    const my = cy + 48;
    if (zombie && mouthOpen <= 0.25 && expr !== "shock" && expr !== "panicked") {
      p.poly([[234, my - 4], [282, my - 10], [276, my + 10], [240, my + 8]], "#5a1e28", 5);
      g.fillStyle = "#f4f1e0"; g.fillRect(246, my - 6, 9, 9); g.fillRect(263, my - 8, 9, 9);
    } else if (expr === "triumphant" || (expr === "laugh" && mouthOpen <= 0.25)) {
      // Big victorious laughing D-mouth with teeth & tongue
      p.ell(256, my - 8, 34, 26, "#5a1e28", 0, 0, 180);
      g.fillStyle = "#ffffff"; g.fillRect(226, my - 8, 60, 10);
      p.ell(258, my + 10, 15, 8, "#e86e78", 0);
      p.ell(256, my - 8, 34, 26, null, 7, 0, 180);
      p.stroke([[222, my - 8], [290, my - 8]], 7);
    } else if (expr === "fake_pain" || expr === "pained") {
      // Wide theatrical gritted white teeth block
      p.poly([[222, my - 11], [290, my - 11], [286, my + 11], [226, my + 11]], "#ffffff", 6);
      for (const tx of [238, 256, 274]) p.stroke([[tx, my - 11], [tx, my + 11]], 4);
    } else if (expr === "panicked") {
      const ry = Math.max(20, 14 + mouthOpen * 20);
      p.ell(256, my + 4, 24, ry, "#5a1e28", 7);
      g.fillStyle = "#ffffff"; g.fillRect(240, my + 4 - ry + 4, 32, 7);
    } else if (expr === "shocked_sweat" && mouthOpen <= 0.25) {
      // Wobbly nervous/shocked wave mouth
      const pts: [number, number][] = [];
      for (let i = 0; i <= 10; i++) pts.push([230 + i * 5.2, my + Math.sin(i * 1.45) * 6]);
      p.stroke(pts, 7.5);
    } else if (mouthOpen > 0.25 || expr === "shock") {
      const ry = 9 + mouthOpen * 18;
      p.ell(256, my, 21, ry, "#5a1e28", 6.5);
      if (zombie) { g.fillStyle = "#f4f1e0"; g.fillRect(246, my - ry + 4, 8, 8); g.fillRect(260, my - ry + 4, 8, 8); }
    } else if (expr === "smug") {
      // Crooked confident side smirk + tiny dimple crease
      p.stroke([[234, my + 4], [260, my + 2], [284, my - 10]], 8);
      p.stroke([[284, my - 15], [290, my - 6]], 5);
    } else if (expr === "annoyed" || expr === "stern") {
      p.arc(256, my + 12, 20, 10, 200, 340, 8);
    } else if (expr === "deadpan") {
      p.stroke([[234, my + 2], [278, my + 2]], 8);
    } else if (expr === "grin" || expr === "smile") {
      p.arc(256, my - 4, 20, 10, 20, 160, 7.5);
    } else {
      p.stroke([[242, my], [270, my - 2]], 7.5);
    }

    // Optional painted temple sweat droplet accent (reinforces 3D drop in front close-ups)
    if (sweatOn) {
      const dy = (sweatStep / 12) * 16;
      g.save();
      g.fillStyle = "#76d4ff";
      g.strokeStyle = BOLD_INK;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(334, cy - 42 + dy);
      g.quadraticCurveTo(350, cy - 12 + dy, 334, cy - 6 + dy);
      g.quadraticCurveTo(318, cy - 12 + dy, 334, cy - 42 + dy);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#ffffff";
      g.beginPath(); g.arc(329, cy - 16 + dy, 3.5, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    if (this.style.grime) {
      // keep the eyes / mouth readable: grime only on the cheeks, forehead and around the head
      g.save();
      g.beginPath(); g.rect(0, 150, 512, 362); g.rect(196, 214, 120, 120); g.clip("evenodd");
      grime(g, seeded((this.style.seed ?? 1) + 17), 512, 1.1, 4, 1);
      g.restore();
    }
    this.faceTex.needsUpdate = true;
  }

  private updateTube(mesh: THREE.Mesh, a: THREE.Vector3, mid: THREE.Vector3, b: THREE.Vector3, radius = 0.022) {
    mesh.geometry.dispose();
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    mesh.geometry = new THREE.TubeGeometry(curve, 10, radius, 6, false);
  }

  pose(p: RigPose) {
    const f = p.frame ?? 0;
    const es = p.exprState;
    const expr = p.expr ?? es?.expr ?? "neutral";
    const blink = p.blink ?? es?.blink ?? 0;
    const shadesOn = p.shades !== undefined ? p.shades : !!this.style.shades;
    const sweatOn = p.sweatDrop !== undefined
      ? p.sweatDrop
      : es?.sweatDrop ?? (expr === "shocked_sweat" || expr === "panicked");
    const motionKind: false | MotionLineKind = p.motionLines !== undefined
      ? (p.motionLines === true ? (expr === "panicked" ? "panic" : "shock") : p.motionLines)
      : (es?.motionLines ?? false);

    this.root.visible = true;
    this.root.position.set(...p.pos);
    this.root.rotation.set(0, p.yaw ?? 0, 0);
    this.torsoPivot.rotation.set(p.lean ?? 0, 0, 0);
    this.headPivot.rotation.set(
      (p.headPitch ?? 0) + (es?.headPitchDelta ?? 0),
      (p.headYaw ?? 0) + (es?.headYawDelta ?? 0),
      0,
    );
    const squash = es?.squashY ?? 1;
    this.headMesh.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    this.brace.visible = !!p.brace;

    // Active hat resolution: explicit p.hat > legacy p.cap > style.hat > "none"
    const activeHat: HatKind = p.hat ?? (p.cap ? "police" : (this.style.hat ?? "none"));
    for (const [kind, group] of Object.entries(this.hats)) {
      group.visible = kind === activeHat;
    }

    // Swappable 3D sunglasses
    this.shades3D.visible = shadesOn;

    // Animated 3D comedic sweat drop
    this.sweatDrop3D.visible = sweatOn;
    if (sweatOn) {
      const cycle = (f % 24) / 24;
      this.sweatDrop3D.position.set(0.245, 0.285 - cycle * 0.06, 0.07);
      const s = 0.85 + 0.25 * Math.sin(cycle * Math.PI);
      this.sweatDrop3D.scale.setScalar(s);
    }

    // Animated 3D radial motion lines behind head
    this.motionLines3D.visible = !!motionKind;
    if (motionKind) {
      const pulse = motionKind === "panic"
        ? 1.0 + 0.14 * Math.sin(f * 1.9)
        : motionKind === "speed"
          ? 1.05 + 0.1 * Math.cos(f * 1.4)
          : 1.0 + 0.08 * ((f % 2) * 2 - 1);
      this.motionLines3D.scale.setScalar(pulse);
      this.motionLines3D.rotation.z = ((f % 3) - 1) * 0.04;
    }

    this.redrawFace(expr, blink, p.mouthOpen ?? 0, shadesOn, sweatOn, f);

    // Local-space limb endpoints relative to root
    const shL = new THREE.Vector3(-0.20, 1.12, 0), shR = new THREE.Vector3(0.20, 1.12, 0);
    if (p.armsFollowLean && p.lean) {
      const c = Math.cos(p.lean), s = Math.sin(p.lean);
      for (const sh of [shL, shR]) sh.set(sh.x, 0.72 + 0.40 * c, 0.40 * s);
    }
    const hL = p.handL ? new THREE.Vector3(...p.handL) : new THREE.Vector3(-0.26, 0.72, 0.12);
    const hR = p.handR ? new THREE.Vector3(...p.handR) : new THREE.Vector3(0.26, 0.72, 0.12);
    const elL = shL.clone().lerp(hL, 0.5).add(new THREE.Vector3(-0.08, -0.06, -0.05));
    const elR = shR.clone().lerp(hR, 0.5).add(new THREE.Vector3(0.08, -0.06, -0.05));
    this.updateTube(this.armL, shL, elL, hL);
    this.updateTube(this.armR, shR, elR, hR);
    this.handSphereL.position.copy(hL);
    this.handSphereR.position.copy(hR);

    // Swappable handheld coffee cup
    const cupSide = p.coffeeCup !== undefined ? p.coffeeCup : (this.style.coffeeCup ?? false);
    this.coffeeCupProp.visible = !!cupSide;
    if (cupSide) {
      const hand = cupSide === "L" ? hL : hR;
      this.coffeeCupProp.position.set(hand.x, hand.y + 0.045, hand.z + 0.03);
      this.coffeeCupProp.rotation.set(0, 0, cupSide === "L" ? 0.08 : -0.08);
      this.coffeeSteam.forEach((puff, idx) => {
        const cyc = ((f * 0.04 + idx * 0.33) % 1);
        puff.position.set(Math.sin(f * 0.15 + idx * 2) * 0.018, 0.10 + cyc * 0.11, 0);
        puff.scale.setScalar(0.6 + cyc * 0.8);
        (puff.material as THREE.MeshBasicMaterial).opacity = (1 - cyc) * 0.65;
      });
    }

    // Swappable handheld smartphone
    const phoneSide = p.phone !== undefined ? p.phone : (this.style.phone ?? false);
    this.phoneProp.visible = !!phoneSide;
    if (phoneSide) {
      const hand = phoneSide === "L" ? hL : hR;
      this.phoneProp.position.set(hand.x, hand.y + 0.03, hand.z + 0.025);
      this.phoneProp.rotation.set(-0.25, phoneSide === "L" ? 0.35 : -0.35, 0);
    }

    const hipL = new THREE.Vector3(-0.10, 0.72, 0), hipR = new THREE.Vector3(0.10, 0.72, 0);
    const fL = p.footL ? new THREE.Vector3(...p.footL) : new THREE.Vector3(-0.12, 0.04, 0.05);
    const fR = p.footR ? new THREE.Vector3(...p.footR) : new THREE.Vector3(0.12, 0.04, 0.05);
    const knL = hipL.clone().lerp(fL, 0.5).add(new THREE.Vector3(0, 0.06, 0.12));
    const knR = hipR.clone().lerp(fR, 0.5).add(new THREE.Vector3(0, 0.06, 0.12));
    this.updateTube(this.legL, hipL, knL, fL, 0.024);
    this.updateTube(this.legR, hipR, knR, fR, 0.024);
    this.bootL.position.copy(fL).add(new THREE.Vector3(0, 0.025, 0.05));
    this.bootR.position.copy(fR).add(new THREE.Vector3(0, 0.025, 0.05));
    this.root.updateMatrixWorld(true);
  }

  /** World-space position of a hand after pose(), for attaching held props (checks, tickets, phones). */
  handWorld(side: "L" | "R", out = new THREE.Vector3()) {
    return (side === "L" ? this.handSphereL : this.handSphereR).getWorldPosition(out);
  }
}
