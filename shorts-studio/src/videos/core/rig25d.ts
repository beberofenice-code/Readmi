// Hybrid 2.5D Hero Rig for seated / vehicle / desk interactions without billboard clipping.
// Combines a 3D lathed bean-head + 3D tapered capsule torso (with BackSide #241726 plum outline shells on NOINK)
// + pooled Canvas2D facial expressions + 3D CatmullRom TubeGeometry noodle limbs that reach 3D targets (pedals, wheels, phones).
import * as THREE from "three";
import { INK, SKIN, Pen, Expr } from "./toon";
import { cardShade } from "./cardshade";
import { NOINK } from "./ink";

export type RigPose = {
  pos: [number, number, number];
  yaw?: number;
  lean?: number;
  headYaw?: number;
  headPitch?: number;
  expr?: Expr;
  mouthOpen?: number; // 0..1 from voice/mouth_env.json
  blink?: number;     // 0, 0.5, 1
  handL?: [number, number, number]; // world or local target
  handR?: [number, number, number];
  footL?: [number, number, number];
  footR?: [number, number, number];
  brace?: boolean;    // foam neck brace (scammer after his "injury")
  cap?: boolean;      // police cap (trooper)
};

const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const limbMat = new THREE.MeshBasicMaterial({ color: INK });

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

const addPlumHull = (mesh: THREE.Mesh, thickness = 1.05) => {
  const hull = new THREE.Mesh(mesh.geometry, outlineMat);
  hull.scale.setScalar(thickness);
  hull.layers.set(NOINK);
  mesh.add(hull);
};

export type RigStyle = {
  skin?: string;
  jacket: string;
  vest?: string;       // e.g., "#e8d238" yellow vest for the brake-check scammer
  tie?: string;
  hair?: string;
  shades?: boolean;    // gold/dark sunglasses for Shot 6 cash mountain
};

export class HeroRig25D {
  root = new THREE.Group();
  torsoPivot = new THREE.Group();
  headPivot = new THREE.Group();
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
  private cap: THREE.Group;

  constructor(parent: THREE.Object3D, public style: RigStyle) {
    this.root.add(this.torsoPivot);
    this.torsoPivot.position.set(0, 0.72, 0);
    this.headPivot.position.set(0, 0.52, 0);
    this.torsoPivot.add(this.headPivot);

    // 1. 3D Bean Torso + Plum Hull
    const torsoGeo = new THREE.CapsuleGeometry(0.19, 0.30, 10, 18);
    // Texture u=0.5 (vest opening / face centre) lands on local +x by default; the rig's limbs and every pose
    // treat local +z as "forward", so turn the textured shells to face +z.
    torsoGeo.rotateY(-Math.PI / 2);
    const torsoTex = this.makeTorsoTexture(style);
    const torsoMat = cardShade(new THREE.MeshLambertMaterial({ map: torsoTex }));
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.set(0, 0.24, 0);
    torsoMesh.layers.set(NOINK);
    addPlumHull(torsoMesh, 1.055);
    this.torsoPivot.add(torsoMesh);

    // 2. 3D Superellipse Bean Head + Dynamic 2D Face Decal
    this.faceCanvas = document.createElement("canvas");
    this.faceCanvas.width = 512;
    this.faceCanvas.height = 512;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;

    const headGeo = new THREE.SphereGeometry(0.22, 24, 20);
    headGeo.scale(1.06, 0.98, 0.92); // H/W ~0.93 wider-than-tall reference proportion
    headGeo.rotateY(-Math.PI / 2);   // face decal forward (+z), matching limbs and poses
    const headMat = cardShade(new THREE.MeshLambertMaterial({ map: this.faceTex }));
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, 0.20, 0);
    headMesh.layers.set(NOINK);
    addPlumHull(headMesh, 1.05);
    this.headPivot.add(headMesh);

    // 3. 3D Spline Noodle Limbs + Ink-Dot Hands
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
    for (const b of [this.bootL, this.bootR]) { addPlumHull(b, 1.06); b.layers.set(NOINK); this.root.add(b); }

    // 5. Optional neck brace (ring between torso and head) and police cap (on the head pivot)
    const braceGeo = new THREE.CylinderGeometry(0.155, 0.17, 0.13, 20);
    this.brace = new THREE.Mesh(braceGeo, solid("#f2ede1"));
    this.brace.position.set(0, 0.54, 0);
    this.brace.layers.set(NOINK);
    addPlumHull(this.brace, 1.06);
    this.brace.visible = false;
    this.torsoPivot.add(this.brace);

    this.cap = new THREE.Group();
    const capMat = solid("#2a3a63");
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.13, 22), capMat);
    crown.position.set(0, 0.38, -0.01);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 18, 1, false, -Math.PI / 2, Math.PI), capMat);
    brim.scale.set(1, 1, 0.8);
    brim.position.set(0, 0.33, 0.13);
    const badge = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: "#e8c45a" }));
    badge.position.set(0, 0.39, 0.205);
    for (const m of [crown, brim, badge]) { m.layers.set(NOINK); this.cap.add(m); }
    addPlumHull(crown, 1.06);
    this.cap.visible = false;
    this.headPivot.add(this.cap);

    for (const m of [this.armL, this.armR, this.legL, this.legR, this.handSphereL, this.handSphereR]) {
      m.layers.set(NOINK);
      this.root.add(m);
    }
    parent.add(this.root);
  }

  private makeTorsoTexture(st: RigStyle): THREE.CanvasTexture {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 256;
    const g = cv.getContext("2d")!;
    g.fillStyle = st.jacket;
    g.fillRect(0, 0, 256, 256);
    if (st.vest) {
      g.fillStyle = st.vest;
      g.fillRect(0, 30, 102, 200);
      g.fillRect(154, 30, 102, 200);
      g.fillStyle = "#e8eef2"; // reflective stripe
      g.fillRect(0, 150, 256, 18);
    }
    if (st.tie) {
      g.fillStyle = "#ffffff";
      g.fillRect(114, 10, 28, 130);
      g.fillStyle = st.tie;
      g.beginPath();
      g.moveTo(128, 20); g.lineTo(140, 125); g.lineTo(128, 145); g.lineTo(116, 125); g.closePath();
      g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private redrawFace(expr: Expr, blink: number, mouthOpen: number) {
    const key = `${expr}|${blink.toFixed(1)}|${Math.round(mouthOpen * 6)}|${this.style.shades ? 1 : 0}`;
    if (key === this.lastFaceKey) return;
    this.lastFaceKey = key;
    const g = this.faceCanvas.getContext("2d")!;
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = this.style.skin ?? SKIN;
    g.fillRect(0, 0, 512, 512);

    if (this.style.hair) {
      g.fillStyle = this.style.hair;
      g.fillRect(0, 0, 512, 155);
    }

    const p = new Pen(g);
    const cy = 248, exL = 224, exR = 288;
    // Eyes or sunglasses
    if (this.style.shades) {
      p.poly([[192, cy - 18], [250, cy - 18], [246, cy + 16], [196, cy + 16]], "#181622", 6);
      p.poly([[262, cy - 18], [320, cy - 18], [316, cy + 16], [266, cy + 16]], "#181622", 6);
      p.stroke([[250, cy - 8], [262, cy - 8]], 6, "#e8c45a");
    } else if (blink >= 0.8 || expr === "pained") {
      p.stroke([[exL - 16, cy], [exL + 16, cy]], 8);
      p.stroke([[exR - 16, cy], [exR + 16, cy]], 8);
    } else if (expr === "shock") {
      p.ell(exL, cy, 20, 20, "#ffffff", 6); p.dot(exL, cy, 6);
      p.ell(exR, cy, 20, 20, "#ffffff", 6); p.dot(exR, cy, 6);
    } else {
      p.ell(exL, cy, 12, 10, INK, 0, 0, 180); p.stroke([[exL - 16, cy], [exL + 16, cy]], 7);
      p.ell(exR, cy, 12, 10, INK, 0, 0, 180); p.stroke([[exR - 16, cy], [exR + 16, cy]], 7);
    }
    // Brows
    const browLift = expr === "shock" ? -16 : expr === "stern" ? 6 : 0;
    p.stroke([[exL - 18, cy - 32 + browLift], [exL + 16, cy - 34]], 9);
    p.stroke([[exR - 16, cy - 34], [exR + 18, cy - 32 + browLift]], 9);

    // Mouth (driven by mouthOpen or expression)
    const my = cy + 44;
    if (mouthOpen > 0.25 || expr === "shock" || expr === "laugh") {
      const ry = 8 + mouthOpen * 18;
      p.ell(256, my, 20, ry, "#5a1e28", 6);
    } else if (expr === "pained") {
      p.poly([[232, my - 8], [280, my - 8], [278, my + 8], [234, my + 8]], "#ffffff", 5);
    } else if (expr === "grin" || expr === "smile") {
      p.arc(256, my - 4, 18, 9, 20, 160, 7);
    } else {
      p.stroke([[244, my], [268, my - 2]], 7);
    }
    this.faceTex.needsUpdate = true;
  }

  private updateTube(mesh: THREE.Mesh, a: THREE.Vector3, mid: THREE.Vector3, b: THREE.Vector3, radius = 0.022) {
    mesh.geometry.dispose();
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    mesh.geometry = new THREE.TubeGeometry(curve, 10, radius, 6, false);
  }

  pose(p: RigPose) {
    this.root.visible = true;
    this.root.position.set(...p.pos);
    this.root.rotation.set(0, p.yaw ?? 0, 0);
    this.torsoPivot.rotation.set(p.lean ?? 0, 0, 0);
    this.headPivot.rotation.set(p.headPitch ?? 0, p.headYaw ?? 0, 0);
    this.brace.visible = !!p.brace;
    this.cap.visible = !!p.cap;
    this.redrawFace(p.expr ?? "neutral", p.blink ?? 0, p.mouthOpen ?? 0);

    // Local-space limb endpoints relative to root
    const shL = new THREE.Vector3(-0.20, 1.12, 0), shR = new THREE.Vector3(0.20, 1.12, 0);
    const hL = p.handL ? new THREE.Vector3(...p.handL) : new THREE.Vector3(-0.26, 0.72, 0.12);
    const hR = p.handR ? new THREE.Vector3(...p.handR) : new THREE.Vector3(0.26, 0.72, 0.12);
    const elL = shL.clone().lerp(hL, 0.5).add(new THREE.Vector3(-0.08, -0.06, -0.05));
    const elR = shR.clone().lerp(hR, 0.5).add(new THREE.Vector3(0.08, -0.06, -0.05));
    this.updateTube(this.armL, shL, elL, hL);
    this.updateTube(this.armR, shR, elR, hR);
    this.handSphereL.position.copy(hL);
    this.handSphereR.position.copy(hR);

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
