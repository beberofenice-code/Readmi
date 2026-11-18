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
  armsFollowLean?: boolean; // shoulders follow the torso lean (lying in bed, deep crouch); default keeps them upright
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
  vest?: string;       // e.g., "#e8d238" yellow vest for the brake-check scammer
  tie?: string;
  hair?: string;
  shades?: boolean;    // gold/dark sunglasses for Shot 6 cash mountain
  stripes?: string;    // horizontal pajama stripes over the jacket colour
  torn?: boolean;      // ripped shirt with skin showing through the tears (zombies)
  zombie?: boolean;    // blank white eyes with pin pupils, eye bags, stitched cheek, crooked open mouth
  grime?: boolean;     // ketchup splats, coffee-ground smudges and stuck-on bandages (torso + face)
  seed?: number;       // varies tears / splats between cast members
  bib?: string;        // pinned race-bib number on the chest (charity-walk entrants)
  beard?: string;      // full beard + moustache painted round the mouth (pair with a 3D beard mesh on headPivot)
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
    // Eyes or sunglasses
    if (this.style.shades) {
      p.poly([[192, cy - 18], [250, cy - 18], [246, cy + 16], [196, cy + 16]], "#181622", 6);
      p.poly([[262, cy - 18], [320, cy - 18], [316, cy + 16], [266, cy + 16]], "#181622", 6);
      p.stroke([[250, cy - 8], [262, cy - 8]], 6, "#e8c45a");
    } else if (blink >= 0.8 || expr === "pained") {
      p.stroke([[exL - 16, cy], [exL + 16, cy]], 8);
      p.stroke([[exR - 16, cy], [exR + 16, cy]], 8);
    } else if (zombie) {
      // blank mismatched eyes with pin pupils (wider when shocked / stared at)
      const big = expr === "shock" ? 1.2 : 1;
      p.ell(exL, cy, 19 * big, 17 * big, "#f4f3e8", 6); p.dot(exL + 5, cy + 3, 4);
      p.ell(exR, cy - 2, 15 * big, 15 * big, "#f4f3e8", 6); p.dot(exR - 3, cy - 4, 4);
    } else if (expr === "shock") {
      p.ell(exL, cy, 20, 20, "#ffffff", 6); p.dot(exL, cy, 6);
      p.ell(exR, cy, 20, 20, "#ffffff", 6); p.dot(exR, cy, 6);
    } else {
      p.ell(exL, cy, 12, 10, INK, 0, 0, 180); p.stroke([[exL - 16, cy], [exL + 16, cy]], 7);
      p.ell(exR, cy, 12, 10, INK, 0, 0, 180); p.stroke([[exR - 16, cy], [exR + 16, cy]], 7);
    }
    // Brows (zombies: one droops)
    const browLift = expr === "shock" ? -16 : expr === "stern" ? 6 : 0;
    p.stroke([[exL - 18, cy - 32 + browLift + (zombie ? 6 : 0)], [exL + 16, cy - 34]], 9);
    p.stroke([[exR - 16, cy - 34], [exR + 18, cy - 32 + browLift]], 9);

    // Mouth (driven by mouthOpen or expression)
    const my = cy + 44;
    if (this.style.beard) {
      // cheek-to-chin beard with a moustache; the mouth is painted on top so it stays readable
      g.fillStyle = this.style.beard;
      g.beginPath(); g.moveTo(150, cy + 4); g.quadraticCurveTo(150, 512, 256, 512); g.quadraticCurveTo(362, 512, 362, cy + 4);
      g.lineTo(340, cy + 18); g.quadraticCurveTo(256, cy + 30, 172, cy + 18); g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 3;
      for (let x = 166; x < 350; x += 14) { g.beginPath(); g.moveTo(x, cy + 30); g.quadraticCurveTo(x + 6, cy + 120, x - 4, 500); g.stroke(); }
      g.fillStyle = this.style.beard;
      g.beginPath(); g.ellipse(232, my - 15, 30, 11, 0.18, 0, Math.PI * 2); g.ellipse(280, my - 15, 30, 11, -0.18, 0, Math.PI * 2); g.fill();
    }
    if (zombie && mouthOpen <= 0.25 && expr !== "shock") {
      // crooked slack mouth with two teeth
      p.poly([[234, my - 4], [282, my - 10], [276, my + 10], [240, my + 8]], "#5a1e28", 5);
      g.fillStyle = "#f4f1e0"; g.fillRect(246, my - 6, 9, 9); g.fillRect(263, my - 8, 9, 9);
    } else if (mouthOpen > 0.25 || expr === "shock" || expr === "laugh") {
      const ry = 8 + mouthOpen * 18;
      p.ell(256, my, 20, ry, "#5a1e28", 6);
      if (zombie) { g.fillStyle = "#f4f1e0"; g.fillRect(246, my - ry + 4, 8, 8); g.fillRect(260, my - ry + 4, 8, 8); }
    } else if (expr === "pained") {
      p.poly([[232, my - 8], [280, my - 8], [278, my + 8], [234, my + 8]], "#ffffff", 5);
    } else if (expr === "grin" || expr === "smile") {
      p.arc(256, my - 4, 18, 9, 20, 160, 7);
    } else {
      p.stroke([[244, my], [268, my - 2]], 7);
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
