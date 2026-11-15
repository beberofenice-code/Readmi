// Modular 3D Set Registry for "What If You Woke Up and Everyone Was Gone?":
// bedroom, street (day / blackout night / golden memory), highway (origin-locked treadmill), market, mansion,
// plant, kitchen, tower. Only the active shot's set Group is visible per frame; everything is a pure function of
// the frame number so per-shot chunks and stills are deterministic.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D } from "../core/rig25d";
import { FPS, SHOTS, HWY_SPEED, TOWER_TOP, blackoutAt, camAt, cartZ, clamp01, climbY, relightAt, smooth, talkK } from "./story";

type P3 = [number, number, number];

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
/** Deterministic 0..1 hash (stable across renders / chunks) */
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
/** Unlit HDR glow material (values > 1 feed the BloomEffect) */
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const noInk = <T extends THREE.Object3D>(o: T) => { o.traverse((c) => c.layers.set(NOINK)); return o; };
const UP = new THREE.Vector3(0, 1, 0);
/** Thin box member between two points (tower lattice, rails) */
const strut = (a: THREE.Vector3, b: THREE.Vector3, th: number, mat: THREE.Material) => {
  const d = b.clone().sub(a), L = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(th, L, th), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  return m;
};
/** World point -> rig-local target for a rig at `pos` turned by `yaw` */
const toLocal = (pos: P3, yaw: number, w: P3): P3 => {
  const dx = w[0] - pos[0], dz = w[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, w[1] - pos[1], dx * s + dz * c];
};
const backOut = (u: number) => { const x = clamp01(u) - 1; return 1 + x * x * (2.7 * x + 1.7); };

/** Unlit readable prop: textured face plane + lam backing card (so the card still gets an ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#f4efe3") => {
  const g = new THREE.Group();
  const back = box(w + 0.04, h + 0.04, 0.03, col("sign_back_" + backHex, backHex), 0, 0, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.017;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, mat };
};

// ---------------- painted textures ----------------
const clockTex = () => ctex("alarm_clock", 256, 128, (g) => {
  g.fillStyle = "#17191f"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#ff4a3d"; g.font = "bold 96px monospace"; g.textAlign = "center"; g.fillText("7:00", 128, 98);
});
const pictureTex = () => ctex("bed_picture", 256, 192, (g) => {
  g.fillStyle = "#cfe8ff"; g.fillRect(0, 0, 256, 192);
  g.fillStyle = "#ffd65a"; g.beginPath(); g.arc(190, 54, 28, 0, 7); g.fill();
  g.fillStyle = "#6fb85a"; g.beginPath(); g.moveTo(0, 192); g.lineTo(90, 80); g.lineTo(170, 192); g.fill();
  g.fillStyle = "#4f9a4a"; g.beginPath(); g.moveTo(90, 192); g.lineTo(180, 110); g.lineTo(256, 192); g.fill();
});
const newsTex = () => ctex("newspaper", 256, 180, (g) => {
  g.fillStyle = "#efe9d8"; g.fillRect(0, 0, 256, 180);
  g.fillStyle = "#241726"; g.font = "bold 34px serif"; g.textAlign = "center"; g.fillText("DAILY NEWS", 128, 40);
  g.fillRect(14, 50, 228, 4);
  g.fillStyle = "#8a8170";
  for (let i = 0; i < 9; i++) { g.fillRect(14, 66 + i * 12, 104 - (i % 3) * 14, 5); g.fillRect(136, 66 + i * 12, 106 - (i % 2) * 22, 5); }
});
const martTex = () => ctex("mart_sign", 1024, 256, (g) => {
  g.fillStyle = "#e2453c"; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = "#fff6dc"; g.lineWidth = 14; g.strokeRect(14, 14, 996, 228);
  g.fillStyle = "#fff6dc"; g.font = "bold 150px sans-serif"; g.textAlign = "center"; g.fillText("FRESH MART", 512, 182);
});
const registerTex = () => ctex("register_total", 256, 128, (g) => {
  g.fillStyle = "#10261a"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#6dff9a"; g.font = "bold 30px monospace"; g.textAlign = "center"; g.fillText("TOTAL", 128, 40);
  g.font = "bold 64px monospace"; g.fillText("$0.00", 128, 104);
});
const plantTex = () => ctex("plant_sign", 512, 128, (g) => {
  g.fillStyle = "#f2c230"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#241726"; g.font = "bold 84px sans-serif"; g.textAlign = "center"; g.fillText("CITY POWER", 256, 94);
});
const tileTex = (key: string, a: string, b: string, n: number) => ctex(key, 512, 512, (g) => {
  const s = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s);
  }
  g.strokeStyle = "rgba(60,50,60,0.25)"; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); }
});
const scopeTex = (n: number) => ctex("radio_scope_" + n, 256, 128, (g, r) => {
  g.fillStyle = "#0b1f16"; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#6dff9a"; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 64);
  for (let x = 8; x <= 256; x += 8) g.lineTo(x, 64 + (r() - 0.5) * 90);
  g.stroke();
});
/** Translucent "stranger" card: 0 electrician (bulb), 1 plumber (drop), 2 baker (bread), 3 passer-by */
const ghostTex = (v: number) => {
  const t = ctex("ghost_card_" + v, 256, 448, (g) => {
    g.clearRect(0, 0, 256, 448);
    const fill = "rgba(205,240,255,0.66)", line = "rgba(255,255,255,0.96)";
    g.lineJoin = "round"; g.lineCap = "round";
    // legs + body
    g.strokeStyle = line; g.lineWidth = 12;
    g.beginPath(); g.moveTo(104, 392); g.lineTo(100, 438); g.moveTo(152, 392); g.lineTo(156, 438); g.stroke();
    g.fillStyle = fill; g.lineWidth = 7;
    g.beginPath(); (g as any).roundRect(70, 262, 116, 136, 44); g.fill(); g.stroke();
    // head
    g.beginPath(); g.ellipse(128, 212, 54, 48, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // hats
    if (v === 0 || v === 1) {
      g.fillStyle = v === 0 ? "rgba(255,226,120,0.9)" : "rgba(150,200,255,0.9)";
      g.beginPath(); g.ellipse(128, 186, 58, 40, 0, Math.PI, Math.PI * 2); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(62, 186); g.lineTo(v === 0 ? 198 : 214, 186); g.stroke();
    } else if (v === 2) {
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.beginPath(); g.arc(100, 150, 26, 0, 7); g.arc(128, 140, 30, 0, 7); g.arc(156, 150, 26, 0, 7); g.fill();
      g.fillRect(88, 150, 80, 30); g.strokeRect(88, 150, 80, 30);
    }
    // face
    g.fillStyle = "rgba(60,80,110,0.75)";
    g.beginPath(); g.arc(108, 212, 6, 0, 7); g.arc(148, 212, 6, 0, 7); g.fill();
    g.strokeStyle = "rgba(60,80,110,0.75)"; g.lineWidth = 5; g.beginPath(); g.arc(128, 224, 16, 0.25, Math.PI - 0.25); g.stroke();
    // floating job icon
    g.strokeStyle = line; g.lineWidth = 6;
    if (v === 0) {
      g.fillStyle = "rgba(255,232,120,0.96)"; g.beginPath(); g.arc(128, 58, 30, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "rgba(230,230,240,0.96)"; g.fillRect(114, 86, 28, 18); g.strokeRect(114, 86, 28, 18);
    } else if (v === 1) {
      g.fillStyle = "rgba(110,190,255,0.96)"; g.beginPath(); g.moveTo(128, 18); g.bezierCurveTo(170, 70, 160, 104, 128, 104);
      g.bezierCurveTo(96, 104, 86, 70, 128, 18); g.fill(); g.stroke();
    } else if (v === 2) {
      g.fillStyle = "rgba(236,176,96,0.97)"; g.beginPath(); (g as any).roundRect(78, 34, 100, 66, 26); g.fill(); g.stroke();
      g.strokeStyle = "rgba(150,95,40,0.8)"; g.beginPath(); g.moveTo(104, 46); g.lineTo(96, 66); g.moveTo(132, 46); g.lineTo(124, 66); g.moveTo(160, 46); g.lineTo(152, 66); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};

/** Parked low-poly car with two front doors that can be left hanging open */
class ToonCar {
  root = new THREE.Group();
  constructor(bodyHex: string, doorOpen = 0) {
    const bodyMat = col("car_" + bodyHex, bodyHex);
    const darkMat = col("car_dark", "#2d323d");
    const glassMat = col("car_glass", "#6c85b5");
    this.root.add(
      box(1.86, 0.56, 4.2, bodyMat, 0, 0.52, 0), box(1.62, 0.52, 2.1, bodyMat, 0, 1.04, -0.15),
      box(1.52, 0.42, 0.08, glassMat, 0, 1.04, 0.9), box(1.52, 0.42, 0.08, glassMat, 0, 1.04, -1.2),
      box(1.92, 0.22, 0.22, darkMat, 0, 0.34, -2.12), box(1.92, 0.22, 0.22, darkMat, 0, 0.34, 2.12),
    );
    for (const sx of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(sx * 0.95, 0.62, 0.72);
      hinge.add(box(0.07, 0.56, 1.0, bodyMat, 0, 0, -0.5), box(0.05, 0.36, 0.8, glassMat, 0, 0.44, -0.5));
      hinge.rotation.y = -sx * doorOpen;
      this.root.add(hinge);
    }
    const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16).rotateZ(Math.PI / 2);
    for (const [wx, wz] of [[-0.92, 1.3], [0.92, 1.3], [-0.92, -1.3], [0.92, -1.3]]) {
      const w = new THREE.Mesh(wGeo, darkMat); w.position.set(wx, 0.32, wz); w.castShadow = true; this.root.add(w);
    }
  }
}

/** Yellow convertible (open cockpit so the seated rig is visible), modelled facing +z */
const makeConvertible = () => {
  const g = new THREE.Group();
  const body = col("sport_body", "#f6c21c"), dark = col("car_dark", "#2d323d"), seat = col("sport_seat", "#7a2f2a");
  g.add(box(1.9, 0.5, 4.3, body, 0, 0.5, 0));
  g.add(box(1.84, 0.16, 1.7, body, 0, 0.8, 1.3), box(1.84, 0.2, 1.15, body, 0, 0.82, -1.55));
  g.add(box(1.6, 0.05, 0.9, dark, 0, 0.9, 1.3));                                        // hood vent stripe
  g.add(box(1.94, 0.18, 0.2, dark, 0, 0.33, 2.16), box(1.94, 0.18, 0.2, dark, 0, 0.33, -2.16));
  g.add(box(1.9, 0.06, 0.36, dark, 0, 1.2, -2.0), box(0.08, 0.3, 0.1, dark, -0.7, 1.05, -2.0), box(0.08, 0.3, 0.1, dark, 0.7, 1.05, -2.0)); // wing
  for (const sx of [-0.4, 0.4]) g.add(box(0.5, 0.62, 0.14, seat, sx, 1.0, -0.82));     // seat backs
  // windshield frame + glass
  const tilt = -0.5;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.46, 0.01),
    new THREE.MeshBasicMaterial({ color: "#cfe4ff", transparent: true, opacity: 0.16, depthWrite: false }));
  glass.position.set(0, 1.08, 0.36); glass.rotation.x = tilt;
  const top = box(1.74, 0.05, 0.05, dark, 0, 1.29, 0.25);
  const pL = box(0.05, 0.5, 0.05, dark, -0.85, 1.08, 0.36), pR = box(0.05, 0.5, 0.05, dark, 0.85, 1.08, 0.36);
  pL.rotation.x = tilt; pR.rotation.x = tilt;
  g.add(glass, top, pL, pR);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 26), col("cab_wheel", "#1f2128"));
  wheel.position.set(-0.4, 1.0, 0.16); wheel.rotation.x = -0.4;
  g.add(wheel);
  const lampMat = glow(2.4, 2.2, 1.6);
  for (const sx of [-0.66, 0.66]) g.add(noInk(box(0.34, 0.14, 0.05, lampMat, sx, 0.62, 2.16)));
  const wGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16).rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.94, 1.35], [0.94, 1.35], [-0.94, -1.35], [0.94, -1.35]]) {
    const w = new THREE.Mesh(wGeo, dark); w.position.set(wx, 0.34, wz); w.castShadow = true; g.add(w);
  }
  return g;
};

const WIN_DARK: P3 = [0.03, 0.04, 0.08];

export class EmptyWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private moon: THREE.Mesh;
  private sunCache = new Map<number, THREE.Vector3>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private c = new THREE.Color();

  // hero + hand props
  private hero: HeroRig25D;
  private crown: THREE.Group;
  private phone: THREE.Mesh;
  private briefcase: THREE.Group;
  private plunger: THREE.Group;
  private candle: THREE.Group;
  private flame: THREE.Mesh;
  private mic: THREE.Mesh;
  // street
  private winMesh: THREE.InstancedMesh;
  private winZ: number[] = [];
  private winJ: number[] = [];
  private lampMat = glow(0.9, 0.9, 0.85);
  private signalMat = glow(1.6, 1.0, 0.1);
  private paper: THREE.Mesh;
  private ghosts: THREE.InstancedMesh[] = [];
  private ghostPts: { x: number; z: number; at: number; s: number }[][] = [[], [], [], []];
  // highway
  private hwyDashes: THREE.InstancedMesh;
  private hwyPoles: THREE.InstancedMesh;
  private hwyTrees: THREE.InstancedMesh;
  private sportCar: THREE.Group;
  // market
  private products: THREE.InstancedMesh;
  private prodCol: THREE.Color[] = [];
  private prodRot: THREE.Color[] = [];
  private prodPts: { x: number; y: number; z: number; sy: number }[] = [];
  private stink: THREE.InstancedMesh;
  private cart: THREE.Group;
  private martSign: THREE.MeshBasicMaterial;
  private regSign: THREE.MeshBasicMaterial;
  private martLights = glow(2.2, 2.2, 2.0);
  private flies: THREE.InstancedMesh;
  // mansion
  private manWin = glow(2.0, 1.4, 0.6);
  private suitcase: THREE.Mesh;
  // plant
  private puffs: THREE.Mesh[] = [];
  private plantWin = glow(2.2, 1.6, 0.7);
  private plantBeacon = glow(3, 0.2, 0.15);
  private hardHat: THREE.Group;
  // kitchen
  private stream: THREE.Mesh;
  private drops: THREE.Mesh[] = [];
  // tower
  private beacon = glow(3, 0.2, 0.15);
  private scope: THREE.MeshBasicMaterial;

  constructor() {
    const R = this.root;
    // 5-stop elevation sky shader (shared across all sets)
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() },
      },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 36, 20), this.skyMat);
    this.sky.layers.set(NOINK);
    this.sky.renderOrder = -10;
    R.add(this.sky);

    // Night sky: stars + moon ride with the camera
    const sp: number[] = [];
    for (let i = 0; i < 520; i++) {
      const az = hash(i * 1.7) * Math.PI * 2, el = Math.asin(0.04 + 0.96 * hash(i * 3.3 + 1));
      sp.push(700 * Math.cos(el) * Math.sin(az), 700 * Math.sin(el), 700 * Math.cos(el) * Math.cos(az));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1.5, 1.6, 1.9), size: 3.2, sizeAttenuation: false, fog: false, depthWrite: false }));
    this.stars.layers.set(NOINK); this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(30, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.32), fog: false, depthWrite: false }));
    this.moon.layers.set(NOINK); this.moon.renderOrder = -8;
    R.add(this.stars, this.moon);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);

    for (const name of ["bedroom", "street", "highway", "market", "mansion", "plant", "kitchen", "tower"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }
    const grassMat = col("grass", "#6eb043");
    const asphalt = () => twoTone(new THREE.MeshPhongMaterial({ color: "#4b505c", specular: "#6f788a", shininess: 45 }));
    const dashMat = col("dash", "#f5e9c8");
    const wood = col("wood", "#b98a5e"), woodDark = col("wood_dark", "#7a5234");

    // ---- 1. BEDROOM (Shot 1) ---- bed along z, headboard against the back wall; camera looks +z
    const bed = this.sets.bedroom;
    bed.add(box(9, 0.1, 9, wood, 0, -0.05, 0));
    bed.add(box(9, 3.6, 0.1, col("bed_wall", "#a9c1dd"), 0, 1.8, 2.25), box(0.1, 3.6, 9, col("bed_wall2", "#97b2d2"), -2.7, 1.8, 0));
    bed.add(box(9, 0.14, 0.04, col("skirting", "#f3eee2"), 0, 0.07, 2.19));
    bed.add(box(1.44, 0.3, 2.3, woodDark, -0.5, 0.15, 0.95), box(1.32, 0.2, 2.2, col("mattress", "#f3f0e8"), -0.5, 0.4, 0.95));
    bed.add(box(1.52, 1.15, 0.1, woodDark, -0.5, 0.75, 2.13));
    bed.add(box(0.95, 0.15, 0.42, col("pillow", "#ffffff"), -0.5, 0.57, 1.86));
    bed.add(box(1.36, 0.25, 1.32, col("blanket", "#d9534f"), -0.5, 0.6, 0.7), box(1.38, 0.08, 0.2, col("blanket_fold", "#f6e7d2"), -0.5, 0.7, 1.32));
    bed.add(box(0.52, 0.55, 0.45, woodDark, 0.6, 0.275, 1.92));
    const clock = sign(0.3, 0.15, clockTex(), "#2a2d36");
    clock.g.position.set(0.6, 0.65, 1.78); clock.g.rotation.y = Math.PI;
    bed.add(clock.g);
    bed.add(cyl(0.035, 0.06, 0.26, col("lamp_base", "#e8c45a"), 0.74, 0.68, 2.0), cyl(0.1, 0.16, 0.2, col("lamp_shade", "#fff0c8"), 0.74, 0.9, 2.0));
    // window with curtains + framed picture
    bed.add(box(1.5, 1.4, 0.06, col("window_trim", "#f7f3ea"), 1.75, 1.85, 2.19));
    bed.add(noInk(box(1.3, 1.2, 0.06, glow(1.25, 1.55, 1.95), 1.75, 1.85, 2.17)));
    bed.add(box(0.05, 1.2, 0.07, col("window_trim", "#f7f3ea"), 1.75, 1.85, 2.15), box(1.3, 0.05, 0.07, col("window_trim", "#f7f3ea"), 1.75, 1.85, 2.15));
    bed.add(box(0.34, 1.6, 0.06, col("curtain", "#f0a23a"), 0.9, 1.85, 2.12), box(0.34, 1.6, 0.06, col("curtain", "#f0a23a"), 2.6, 1.85, 2.12));
    const pic = sign(0.6, 0.45, pictureTex(), "#7a5234");
    pic.g.position.set(-1.7, 1.95, 2.18); pic.g.rotation.y = Math.PI;
    bed.add(pic.g);
    bed.add(box(1.7, 0.02, 1.1, col("rug", "#7fa7c9"), 0.9, 0.01, 0.5));

    // ---- 2. STREET (Shots 2, 3 day / 7 night blackout / 12 golden memory) ---- avenue along +z
    const st = this.sets.street;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 270).rotateX(-Math.PI / 2), asphalt());
    road.position.set(0, 0, 95); road.receiveShadow = true;
    st.add(road);
    const walk = col("sidewalk", "#c9c2b4");
    st.add(box(4, 0.16, 270, walk, -7, 0, 95), box(4, 0.16, 270, walk, 7, 0, 95));
    const sDash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 2.4).rotateX(-Math.PI / 2), dashMat, 44);
    for (let i = 0; i < 44; i++) { this.m4.makeTranslation(0, 0.02, -36 + i * 6); sDash.setMatrixAt(i, this.m4); }
    sDash.frustumCulled = false; sDash.receiveShadow = true;
    st.add(sDash);
    const pal = ["#e8c9a0", "#d9a58c", "#b9c7d8", "#e6dcc6", "#c9b6d6", "#a9c9b4", "#e2b36f", "#c8ccd4"];
    const winPts: { x: number; y: number; z: number; side: number }[] = [];
    for (const side of [-1, 1]) {
      let z = -36;
      for (let i = 0; i < 19; i++) {
        const w = 8 + 5 * hash(i * 3.1 + side), h = 9 + 13 * hash(i * 7.7 + side * 2.3), k = Math.floor(hash(i * 5.3 + side) * pal.length);
        const zc = z + w / 2;
        st.add(box(10, h, w, col("bldg_" + pal[k], pal[k]), side * 14, h / 2, zc));
        st.add(box(10.3, 0.35, w + 0.2, col("bldg_cap", "#8c8478"), side * 14, h + 0.17, zc));
        st.add(box(0.5, 0.12, w - 0.6, col("awning_" + (i % 3), ["#d9534f", "#3f8f7a", "#3f6b8f"][i % 3]), side * 8.8, 3.05, zc)); // shop-front band
        const nc = Math.max(1, Math.floor((w - 1.4) / 2.4)), nr = Math.max(1, Math.floor((h - 3.4) / 2.9));
        for (let a = 0; a < nc; a++) for (let b = 0; b < nr; b++) {
          winPts.push({ x: side * 8.985, y: 4.6 + b * 2.9, z: zc + (a - (nc - 1) / 2) * 2.4, side });
        }
        // shop window + door on the ground floor
        winPts.push({ x: side * 8.985, y: 1.55, z: zc - w * 0.18, side }, { x: side * 8.985, y: 1.55, z: zc + w * 0.18, side });
        z += w + 0.5;
      }
    }
    st.add(box(60, 34, 10, col("bldg_far", "#b9c7d8"), 0, 17, 232));
    this.winMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.25, 1.6), new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide }), winPts.length);
    winPts.forEach((p, i) => {
      this.m4.makeRotationY(p.side > 0 ? -Math.PI / 2 : Math.PI / 2); this.m4.setPosition(p.x, p.y, p.z);
      this.winMesh.setMatrixAt(i, this.m4);
      this.winMesh.setColorAt(i, this.c.setRGB(0.4, 0.5, 0.7));
      this.winZ.push(p.z); this.winJ.push(hash(i * 2.9 + 0.4));
    });
    this.winMesh.frustumCulled = false; this.winMesh.layers.set(NOINK);
    st.add(this.winMesh);
    const pole = col("lamp_pole", "#3a3f4a"), trunk = col("trunk", "#7a5234"), leaf = col("leaf", "#5aa845");
    for (let k = 0; k < 11; k++) for (const side of [-1, 1]) {
      const z = -22 + k * 18 + (side > 0 ? 9 : 0);
      st.add(box(0.14, 5.2, 0.14, pole, side * 5.55, 2.6, z), box(1.1, 0.1, 0.12, pole, side * 5.05, 5.15, z));
      st.add(noInk(ball(0.2, this.lampMat, side * 4.55, 5.0, z)));
      st.add(box(0.3, 2.3, 0.3, trunk, side * 7.6, 1.2, z + 6));
      const crown = ball(1.35, leaf, side * 7.6, 3.4, z + 6); crown.scale.set(1, 0.9, 1);
      st.add(crown);
    }
    // traffic signal stuck on blinking amber
    st.add(box(0.16, 4.2, 0.16, pole, -5.35, 2.1, 10), box(0.4, 1.1, 0.3, pole, -5.35, 4.3, 10));
    st.add(noInk(ball(0.13, this.signalMat, -5.35, 4.3, 9.82)));
    const parked: [number, number, number, string, number][] = [
      [-2.5, 6.5, 0.1, "#d43b3b", 1.05], [2.6, 13, 3.3, "#3b78c4", 0.8], [-1.3, 23, 0.5, "#f0f0f0", 1.1],
      [2.7, 32, -0.12, "#e09a2b", 0.6], [-2.6, 43, 0.05, "#58a55c", 0.9], [1.2, 56, 0.9, "#7a5ac8", 1.0], [-2.2, 74, -0.2, "#d43b3b", 0.7],
    ];
    for (const [x, z, yaw, hex, open] of parked) {
      const c = new ToonCar(hex, open);
      c.root.position.set(x, 0, z); c.root.rotation.y = yaw;
      st.add(c.root);
    }
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ map: newsTex(), side: THREE.DoubleSide }));
    this.paper.layers.set(NOINK);
    st.add(this.paper);
    // the strangers (4 card variants; instance 0 of variants 0-2 is the featured electrician / plumber / baker)
    const gGeo = new THREE.PlaneGeometry(1.1, 1.925).translate(0, 0.9625, 0);
    const feat: [number, number, number][] = [[-1.55, 2.7, 1398], [1.55, 2.7, 1426], [-2.7, 4.3, 1449]];
    for (let v = 0; v < 4; v++) {
      if (v < 3) this.ghostPts[v].push({ x: feat[v][0], z: feat[v][1], at: feat[v][2], s: 1.08 });
      for (let i = 0; i < 46; i++) {
        const k = v * 100 + i;
        const z = 5.5 + 78 * Math.pow(hash(k * 1.31), 1.25), x = (hash(k * 2.17 + 3) - 0.5) * 17;
        if (Math.abs(x) < 0.9 && z < 12) continue;
        this.ghostPts[v].push({ x, z, at: 1486 + 0.95 * (z - 5.5) + 8 * hash(k * 4.7), s: 0.92 + 0.2 * hash(k * 6.1) });
      }
      this.ghostPts[v].sort((a, b) => b.z - a.z);
      const mesh = new THREE.InstancedMesh(gGeo, new THREE.MeshBasicMaterial({ map: ghostTex(v), transparent: true, depthWrite: false, side: THREE.DoubleSide }), this.ghostPts[v].length);
      mesh.frustumCulled = false; mesh.layers.set(NOINK); mesh.renderOrder = 5;
      this.ghosts.push(mesh);
      st.add(mesh);
    }

    // ---- 3. HIGHWAY TREADMILL (Shot 4) ---- convertible stays at the origin; dashes, poles and trees scroll past
    const hwy = this.sets.highway;
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(13, 300).rotateX(-Math.PI / 2), asphalt());
    hRoad.receiveShadow = true;
    hwy.add(hRoad, box(150, 0.1, 300, grassMat, -81.5, -0.06, 0), box(150, 0.1, 300, grassMat, 81.5, -0.06, 0));
    this.hwyDashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 2.6).rotateX(-Math.PI / 2), dashMat, 80);
    this.hwyPoles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 5, 0.16).translate(0, 2.5, 0), pole, 24);
    this.hwyTrees = new THREE.InstancedMesh(new THREE.SphereGeometry(1.7, 12, 9).translate(0, 2.6, 0), leaf, 24);
    for (const m of [this.hwyDashes, this.hwyPoles, this.hwyTrees]) { m.frustumCulled = false; m.castShadow = true; hwy.add(m); }
    this.sportCar = makeConvertible();
    hwy.add(this.sportCar);

    // ---- 4. SUPERMARKET (Shot 5 lit / Shot 10 dark + rotting) ---- aisle along +z between two shelf rows
    const mk = this.sets.market;
    const floorTex = tileTex("mart_floor", "#efe9dc", "#dcd4c2", 8); floorTex.repeat.set(5, 9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 20).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ map: floorTex })));
    floor.position.set(0, 0, 4); floor.receiveShadow = true;
    mk.add(floor);
    const wall = col("mart_wall", "#e9e2d0");
    mk.add(box(11, 4.4, 0.2, wall, 0, 2.2, 12.1), box(0.2, 4.4, 20, wall, -5.5, 2.2, 4), box(0.2, 4.4, 20, wall, 5.5, 2.2, 4), box(11, 0.2, 20, col("mart_ceiling", "#d8d2c4"), 0, 4.45, 4));
    for (let k = 0; k < 4; k++) mk.add(noInk(box(1.6, 0.05, 0.5, this.martLights, 0, 4.32, 0.5 + k * 3.2)));
    const ms = sign(4.2, 1.05, martTex(), "#8e2a24");
    ms.g.position.set(0, 3.3, 11.95); ms.g.rotation.y = Math.PI;
    this.martSign = ms.mat;
    mk.add(ms.g);
    const shelfMat = col("shelf", "#5d6b7c"), boardMat = col("shelf_board", "#f1ede2");
    const prodPal = ["#e2453c", "#f0a23a", "#f6d743", "#58a55c", "#3b78c4", "#7a5ac8", "#ef7fa8", "#f3f0e8", "#3fb3b8"];
    const rotPal = ["#5b5a2c", "#6a4a2a", "#49552b", "#3f3a2e", "#73683a"];
    const prodPts: { x: number; y: number; z: number; sy: number }[] = [];
    for (const side of [-1, 1]) {
      mk.add(box(0.12, 2.3, 11, shelfMat, side * 2.82, 1.15, 5));
      for (let b = 0; b < 4; b++) {
        const y = 0.22 + b * 0.55;
        mk.add(box(0.66, 0.05, 11, boardMat, side * 2.48, y, 5));
        for (let i = 0; i < 26; i++) {
          const k = b * 100 + i + (side > 0 ? 1000 : 0);
          if (hash(k * 1.9) < 0.08) continue;
          prodPts.push({ x: side * (2.44 + 0.06 * hash(k * 3.3)), y, z: -0.2 + i * 0.41, sy: 0.3 + 0.16 * hash(k * 2.1) });
        }
      }
    }
    this.products = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1, 0.3).translate(0, 0.5, 0), col("product", "#ffffff"), prodPts.length);
    prodPts.forEach((p, i) => {
      this.m4.compose(this.v.set(p.x, p.y + 0.025, p.z), this.q.identity(), this.v2.set(1, p.sy, 1));
      this.products.setMatrixAt(i, this.m4);
      this.prodCol.push(new THREE.Color(prodPal[Math.floor(hash(i * 5.7) * prodPal.length)]));
      this.prodRot.push(new THREE.Color(rotPal[Math.floor(hash(i * 8.3) * rotPal.length)]));
      this.products.setColorAt(i, this.prodCol[i]);
    });
    this.prodPts = prodPts;
    this.products.frustumCulled = false; this.products.castShadow = true;
    mk.add(this.products);
    // unattended checkout
    mk.add(box(0.9, 0.9, 2.0, col("checkout", "#4f7f9a"), 1.55, 0.45, 0.6), box(0.7, 0.04, 1.9, col("belt", "#2d323d"), 1.55, 0.92, 0.6));
    mk.add(box(0.4, 0.3, 0.36, col("register", "#d8d2c4"), 1.55, 1.09, -0.1));
    const rs = sign(0.34, 0.17, registerTex(), "#2a2d36");
    rs.g.position.set(1.55, 1.36, -0.12); rs.g.rotation.y = Math.PI;
    this.regSign = rs.mat;
    mk.add(rs.g);
    // overloaded cart
    this.cart = new THREE.Group();
    const wire = col("cart_wire", "#c3c9d2"), cartRed = col("cart_red", "#e2453c");
    this.cart.add(box(0.6, 0.03, 0.9, wire, 0, 0.32, 0), box(0.6, 0.5, 0.025, wire, 0, 0.58, -0.44), box(0.6, 0.5, 0.025, wire, 0, 0.58, 0.44));
    this.cart.add(box(0.025, 0.5, 0.9, wire, -0.3, 0.58, 0), box(0.025, 0.5, 0.9, wire, 0.3, 0.58, 0));
    this.cart.add(box(0.64, 0.035, 0.035, cartRed, 0, 0.98, 0.52), box(0.03, 0.18, 0.03, wire, -0.29, 0.9, 0.48), box(0.03, 0.18, 0.03, wire, 0.29, 0.9, 0.48));
    for (const [wx, wz] of [[-0.26, -0.38], [0.26, -0.38], [-0.26, 0.38], [0.26, 0.38]]) {
      this.cart.add(box(0.03, 0.26, 0.03, wire, wx, 0.19, wz), cyl(0.06, 0.06, 0.04, col("car_dark", "#2d323d"), wx, 0.06, wz, 10).rotateZ(Math.PI / 2));
    }
    for (let i = 0; i < 16; i++) {
      const hgt = 0.22 + 0.2 * hash(i * 3.7);
      const b = box(0.2 + 0.1 * hash(i * 1.3), hgt, 0.18 + 0.1 * hash(i * 2.3), col("prod_" + (i % prodPal.length), prodPal[i % prodPal.length]),
        (hash(i * 4.1) - 0.5) * 0.36, 0.6 + 0.36 * hash(i * 6.3), (hash(i * 9.1) - 0.5) * 0.62);
      b.rotation.set(hash(i * 2.9) - 0.5, hash(i * 7.7) * 3, hash(i * 5.3) - 0.5);
      this.cart.add(b);
    }
    const melon = ball(0.17, col("melon", "#3f8f4a"), 0.05, 1.08, -0.12);
    const bag = cyl(0.045, 0.045, 0.6, col("baguette", "#d9a05a"), -0.16, 1.05, -0.25, 10); bag.rotation.set(0.5, 0, 0.4);
    this.cart.add(melon, bag);
    mk.add(this.cart);
    this.flies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshBasicMaterial({ color: "#0d0c10" }), 14);
    this.flies.frustumCulled = false; this.flies.layers.set(NOINK);
    this.stink = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.95, 0.22), transparent: true, opacity: 0.5, depthWrite: false }), 12);
    this.stink.frustumCulled = false; this.stink.layers.set(NOINK);
    mk.add(this.flies, this.stink);

    // ---- 5. MANSION (Shot 6 golden / Shot 13 night) ---- facade faces -z; lawn, path, steps, porch, columns
    const man = this.sets.mansion;
    const stone = col("man_stone", "#f1ead9"), stoneD = col("man_stone_d", "#d9d0bb");
    man.add(box(160, 0.1, 160, grassMat, 0, -0.05, 0));
    man.add(box(3.2, 0.04, 18, col("path", "#d9cdb4"), 0, 0.0, -7.4));
    man.add(box(6.4, 0.15, 0.6, stoneD, 0, 0.075, 1.9), box(6.4, 0.3, 0.6, stoneD, 0, 0.15, 2.5), box(9.4, 0.45, 3.2, stoneD, 0, 0.225, 4.4));
    man.add(box(19, 8.2, 6, stone, 0, 4.1, 9), box(19.6, 0.45, 6.6, stoneD, 0, 8.4, 9), box(17.5, 1.3, 5, col("man_roof", "#5d6b7c"), 0, 9.2, 9));
    for (const x of [-3.9, -1.55, 1.55, 3.9]) {
      man.add(cyl(0.3, 0.34, 5.0, stone, x, 2.95, 3.3, 18), box(0.86, 0.2, 0.86, stoneD, x, 0.55, 3.3), box(0.86, 0.2, 0.86, stoneD, x, 5.52, 3.3));
    }
    man.add(box(9.6, 0.5, 3.4, stone, 0, 5.87, 4.3));
    const tri = new THREE.Shape(); tri.moveTo(-4.9, 0); tri.lineTo(4.9, 0); tri.lineTo(0, 1.9); tri.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 3.4, bevelEnabled: false }), stone);
    ped.position.set(0, 6.12, 2.6); ped.castShadow = true;
    man.add(ped);
    man.add(box(1.9, 3.1, 0.12, col("man_door", "#6b3f2a"), 0, 2.0, 5.98), box(2.3, 0.25, 0.2, stoneD, 0, 3.68, 5.95));
    man.add(noInk(ball(0.07, glow(1.6, 1.2, 0.4), 0.6, 1.95, 5.88)));
    for (const x of [-7.6, -5.5, 5.5, 7.6]) for (const y of [2.3, 5.6]) {
      man.add(box(1.36, 2.06, 0.08, stoneD, x, y, 5.98), noInk(box(1.1, 1.8, 0.08, this.manWin, x, y, 5.95)));
    }
    for (const x of [-8.6, -6.6, -4.9, 4.9, 6.6, 8.6]) {
      const hedge = ball(0.8, col("hedge", "#3f8f4a"), x, 0.6, 5.2); hedge.scale.set(1.25, 0.9, 1);
      man.add(hedge);
    }
    for (const sx of [-1, 1]) {
      man.add(box(0.5, 3.2, 0.5, trunk, sx * 12.5, 1.6, 1));
      const t1 = ball(2.3, leaf, sx * 12.5, 4.6, 1); t1.scale.set(1, 1.15, 1);
      man.add(t1);
      for (let k = 0; k < 5; k++) man.add(cyl(0.5, 0.6, 0.9, col("hedge", "#3f8f4a"), sx * 2.3, 0.45, -1 - k * 3.2, 12));
    }
    this.suitcase = box(0.46, 0.34, 0.16, col("suitcase", "#b0552f"));
    man.add(this.suitcase);

    // ---- 6. POWER PLANT (Shot 8) ----
    const pl = this.sets.plant;
    pl.add(box(240, 0.1, 240, col("plant_ground", "#7d8a6a"), 0, -0.05, 60));
    pl.add(box(7, 0.04, 60, col("plant_road", "#5b5f6a"), 0, 0.0, 14));
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) { const y = i; profile.push(new THREE.Vector2(2.35 + 1.5 * ((y - 9.5) / 9.5) ** 2, y * 1.15)); }
    const towerGeo = new THREE.LatheGeometry(profile, 30);
    const concrete = lam("cooling", () => ({ color: "#d6d9dc", side: THREE.DoubleSide }));
    const towers: [number, number][] = [[-0.5, 48], [7.0, 57]];
    for (const [x, z] of towers) {
      const t = new THREE.Mesh(towerGeo, concrete); t.position.set(x, 0, z); t.castShadow = true; t.receiveShadow = true;
      pl.add(t, box(0.3, 0.02, 0.3, concrete, x, 0, z));
      pl.add(cyl(2.45, 2.45, 0.5, col("cooling_band", "#d9534f"), x, 15.6, z, 30));
    }
    const puffMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.68, 0.82), transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    for (let i = 0; i < 18; i++) { const p = noInk(ball(1, puffMat)); p.castShadow = false; this.puffs.push(p); pl.add(p); }
    pl.add(box(8, 4.4, 6, col("plant_bldg", "#b9c0c7"), -2.4, 2.2, 28), box(8.4, 0.3, 6.4, col("bldg_cap", "#8c8478"), -2.4, 4.55, 28));
    for (let k = 0; k < 4; k++) pl.add(noInk(box(1.2, 1.1, 0.06, this.plantWin, -5.1 + k * 1.8, 2.5, 24.96)));
    const ps = sign(4.6, 1.15, plantTex(), "#2a2d36");
    ps.g.position.set(-2.4, 5.5, 25.4); ps.g.rotation.y = Math.PI;
    pl.add(ps.g, box(0.16, 1.0, 0.16, pole, -4.3, 4.9, 25.5), box(0.16, 1.0, 0.16, pole, -0.5, 4.9, 25.5));
    pl.add(cyl(0.5, 0.75, 20, col("stack", "#c9b6a6"), 7.4, 10, 31, 14), noInk(ball(0.32, this.plantBeacon, 7.4, 20.3, 31)));
    // chain-link fence with the gate left open
    const fenceMat = col("fence", "#8d949e");
    for (let i = -9; i <= 9; i++) if (i !== 0) {
      pl.add(box(0.1, 2.2, 0.1, fenceMat, i * 2.4, 1.1, 14));
      if (Math.abs(i) > 1) pl.add(box(2.4, 0.06, 0.05, fenceMat, i * 2.4 - Math.sign(i) * 1.2, 2.1, 14), box(2.4, 0.06, 0.05, fenceMat, i * 2.4 - Math.sign(i) * 1.2, 1.1, 14),
        box(2.4, 0.06, 0.05, fenceMat, i * 2.4 - Math.sign(i) * 1.2, 0.2, 14));
    }
    const gate = box(2.3, 2.0, 0.06, fenceMat, -3.0, 1.05, 12.95); gate.rotation.y = 1.1;
    pl.add(gate);
    this.hardHat = new THREE.Group();
    const hatMat = col("hardhat", "#f6c21c");
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatMat); dome.castShadow = true;
    this.hardHat.add(dome, cyl(0.24, 0.24, 0.03, hatMat, 0, 0.015, 0.03, 18), box(0.04, 0.2, 0.3, hatMat, 0, 0.1, 0));
    pl.add(this.hardHat);
    pl.add(box(0.44, 0.26, 0.26, col("lunchbox", "#3b78c4"), -0.9, 0.13, 7.2));
    this.hardHat.scale.setScalar(2.2);

    // ---- 7. KITCHEN (Shot 9) ---- counter + sink against the back wall
    const kt = this.sets.kitchen;
    kt.add(box(8, 0.1, 8, wood, 0, -0.05, 0));
    const kTile = tileTex("kitchen_tile", "#e8eef0", "#dfe7ea", 8); kTile.repeat.set(5, 2.4);
    const kWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.8).rotateY(Math.PI), twoTone(new THREE.MeshLambertMaterial({ map: kTile })));
    kWall.position.set(0, 1.9, 1.42); kWall.receiveShadow = true;
    kt.add(kWall, box(0.1, 3.8, 8, col("kitchen_wall", "#cfd9dc"), -2.6, 1.9, 0));
    kt.add(box(4.2, 0.9, 0.66, col("cabinet", "#3f8f8a"), 0, 0.45, 1.06), box(4.3, 0.06, 0.72, col("counter", "#f1ede2"), 0, 0.93, 1.04));
    for (const x of [-1.5, -0.5, 0.5, 1.5]) kt.add(box(0.04, 0.2, 0.03, col("handle", "#d8d2c4"), x, 0.6, 0.72));
    kt.add(box(0.78, 0.02, 0.44, col("sink", "#8d949e"), 0, 0.965, 1.02), box(0.66, 0.02, 0.34, col("sink_in", "#4b505c"), 0, 0.97, 1.02));
    const chrome = twoTone(new THREE.MeshPhongMaterial({ color: "#c9d2dc", specular: "#ffffff", shininess: 80 }));
    kt.add(cyl(0.028, 0.034, 0.32, chrome, 0, 1.12, 1.3, 12), box(0.05, 0.05, 0.3, chrome, 0, 1.28, 1.17), cyl(0.026, 0.026, 0.07, chrome, 0, 1.24, 1.04, 12));
    for (const x of [-0.16, 0.16]) kt.add(cyl(0.035, 0.035, 0.06, chrome, x, 1.0, 1.3, 12), box(0.1, 0.02, 0.025, chrome, x, 1.04, 1.3));
    const waterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.0, 1.35) });
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 8), waterMat);
    this.stream.position.set(0, 1.09, 1.04); this.stream.layers.set(NOINK);
    kt.add(this.stream);
    for (let i = 0; i < 2; i++) { const d = noInk(ball(0.017, waterMat)); d.scale.set(1, 1.5, 1); this.drops.push(d); kt.add(d); }
    kt.add(box(1.3, 1.1, 0.06, col("window_trim", "#f7f3ea"), 0, 2.1, 1.4), noInk(box(1.12, 0.92, 0.06, glow(0.07, 0.11, 0.24), 0, 2.1, 1.38)));
    kt.add(cyl(0.11, 0.13, 0.2, col("kettle", "#d9534f"), -1.05, 1.06, 1.1, 14), box(0.3, 0.02, 0.22, col("board", "#b98a5e"), 1.3, 0.97, 1.0));
    kt.add(cyl(0.05, 0.05, 0.11, col("glass_cup", "#b9d4e6"), -0.42, 1.02, 0.86, 12));

    // ---- 8. RADIO TOWER (Shot 11) ---- lattice mast over a blacked-out city
    const tw = this.sets.tower;
    tw.add(box(700, 0.1, 700, col("tower_ground", "#55664f"), 0, -0.05, 0));
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), col("city_dark", "#8b93a6"), 150);
    for (let i = 0; i < 150; i++) {
      const a = hash(i * 1.9) * Math.PI * 2, r = 26 + 190 * hash(i * 3.7);
      this.m4.compose(this.v.set(Math.sin(a) * r, 0, Math.cos(a) * r), this.q.identity(), this.v2.set(6 + 8 * hash(i * 5.1), 5 + 16 * hash(i * 7.3), 6 + 8 * hash(i * 2.3)));
      city.setMatrixAt(i, this.m4);
    }
    city.frustumCulled = false; city.castShadow = true;
    tw.add(city);
    const steel = col("tower_steel", "#c94f3f"), steelW = col("tower_steel_w", "#f1ede2");
    const hw = (y: number) => 2.7 - 2.25 * (y / TOWER_TOP);
    for (let k = 0; k < 10; k++) {
      const y0 = k * 3, y1 = y0 + 3, w0 = hw(y0), w1 = hw(y1), mat = k % 2 ? steelW : steel;
      const corner = (i: number, w: number, y: number) => new THREE.Vector3([-1, 1, 1, -1][i] * w, y, [-1, -1, 1, 1][i] * w);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        tw.add(strut(corner(i, w0, y0), corner(i, w1, y1), 0.16, mat));
        tw.add(strut(corner(i, w1, y1), corner(j, w1, y1), 0.1, mat));
        tw.add(strut(k % 2 ? corner(i, w0, y0) : corner(j, w0, y0), k % 2 ? corner(j, w1, y1) : corner(i, w1, y1), 0.08, mat));
      }
    }
    const rail = col("tower_rail", "#d8d2c4");
    tw.add(box(0.05, TOWER_TOP, 0.05, rail, -0.2, TOWER_TOP / 2, -0.52), box(0.05, TOWER_TOP, 0.05, rail, 0.2, TOWER_TOP / 2, -0.52));
    const rungs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), rail, 74);
    for (let i = 0; i < 74; i++) { this.m4.makeTranslation(0, 0.4 + i * 0.4, -0.52); rungs.setMatrixAt(i, this.m4); }
    rungs.frustumCulled = false;
    tw.add(rungs);
    tw.add(box(2.6, 0.16, 2.6, col("platform", "#6b7280"), 0, TOWER_TOP, 0));
    for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [1.25, 1.25], [-1.25, 1.25]]) tw.add(box(0.07, 1.0, 0.07, rail, x, TOWER_TOP + 0.55, z));
    tw.add(box(2.6, 0.06, 0.06, rail, 0, TOWER_TOP + 1.05, 1.25), box(0.06, 0.06, 2.6, rail, -1.25, TOWER_TOP + 1.05, 0), box(0.06, 0.06, 2.6, rail, 1.25, TOWER_TOP + 1.05, 0));
    tw.add(box(0.14, 7, 0.14, steel, -0.95, TOWER_TOP + 3.5, 0.9), box(1.6, 0.08, 0.08, steelW, -0.95, TOWER_TOP + 5.2, 0.9), box(1.1, 0.08, 0.08, steelW, -0.95, TOWER_TOP + 6.1, 0.9));
    tw.add(noInk(ball(0.2, this.beacon, -0.95, TOWER_TOP + 7.1, 0.9)));
    // field radio on a crate
    tw.add(box(0.5, 0.42, 0.4, wood, 0.72, TOWER_TOP + 0.29, 0.25), box(0.46, 0.3, 0.26, col("radio", "#4f5d4a"), 0.72, TOWER_TOP + 0.65, 0.25));
    tw.add(box(0.02, 0.5, 0.02, pole, 0.9, TOWER_TOP + 1.05, 0.3));
    const sc = sign(0.26, 0.13, scopeTex(0), "#2a2d36");
    sc.g.position.set(0.68, TOWER_TOP + 0.67, 0.105); sc.g.rotation.y = Math.PI;
    this.scope = sc.mat;
    tw.add(sc.g);

    // ---- hero + hand props (live on the root so every set can use them) ----
    this.hero = new HeroRig25D(R, { jacket: "#2f9aa0", hair: "#5a3b2a" });
    this.crown = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.86, 0.16) });
    this.crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.07, 20, 1, true), gold));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 4), gold);
      sp.position.set(Math.sin(a) * 0.14, 0.085, Math.cos(a) * 0.14);
      this.crown.add(sp);
    }
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glow(2.2, 0.25, 0.3)); gem.position.set(0, 0.0, 0.15);
    this.crown.add(gem);
    (this.crown.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.86, 0.16), side: THREE.DoubleSide });
    this.crown.position.set(0, 0.43, 0); this.crown.rotation.z = 0.08;
    noInk(this.crown);
    this.hero.headPivot.add(this.crown);
    this.phone = box(0.07, 0.14, 0.022, col("phone", "#22252c"));
    this.briefcase = new THREE.Group();
    this.briefcase.add(box(0.44, 0.3, 0.1, woodDark, 0, -0.2, 0), box(0.16, 0.05, 0.03, col("car_dark", "#2d323d"), 0, -0.03, 0));
    this.plunger = new THREE.Group();
    this.plunger.add(cyl(0.016, 0.016, 0.62, wood, 0, 0.2, 0, 8), cyl(0.035, 0.1, 0.09, col("plunger", "#d9534f"), 0, 0.55, 0, 14));
    this.candle = new THREE.Group();
    this.flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow(3.4, 2.2, 0.7));
    this.flame.scale.set(1, 1.7, 1); this.flame.position.y = 0.2; this.flame.layers.set(NOINK);
    this.candle.add(cyl(0.028, 0.03, 0.15, col("candle", "#f3ecd6"), 0, 0.075, 0, 10), cyl(0.07, 0.07, 0.015, col("candle_dish", "#8d949e"), 0, 0.0, 0, 12), this.flame);
    this.mic = ball(0.045, col("mic", "#2d323d"));
    R.add(this.phone, this.briefcase, this.plunger, this.candle, this.mic);
  }

  private shotSun(id: number, L: typeof LIGHTS.day) {
    let v = this.sunCache.get(id);
    if (v) return v;
    const s = SHOTS[id - 1];
    const c = camAt(id, Math.floor((s.a + s.b) / 2));
    const fx = c.look[0] - c.pos[0], fz = c.look[2] - c.pos[2], n = Math.hypot(fx, fz) || 1;
    const ux = fx / n, uz = fz / n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = ux * Math.cos(az) - uz * Math.sin(az), hz = uz * Math.cos(az) + ux * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private hold(obj: THREE.Object3D, side: "L" | "R", dx = 0, dy = 0, dz = 0) {
    this.hero.handWorld(side, this.v);
    obj.position.set(this.v.x + dx, this.v.y + dy, this.v.z + dz);
    obj.visible = true;
  }

  private walkFeet(ph: number, stride = 0.2, lift = 0.1): { footL: P3; footR: P3 } {
    return {
      footL: [-0.12, 0.04 + lift * Math.max(0, Math.sin(ph)), 0.05 + stride * Math.cos(ph)],
      footR: [0.12, 0.04 + lift * Math.max(0, -Math.sin(ph)), 0.05 - stride * Math.cos(ph)],
    };
  }

  private poseStreet(id: number, f: number, t: number) {
    // windows / lamps per lighting state
    const n = this.winZ.length;
    for (let i = 0; i < n; i++) {
      const z = this.winZ[i], j = this.winJ[i], j2 = hash(i * 7.1 + 2);
      let r = 0.36, g = 0.5, b = 0.7, k = 0.85 + 0.3 * j;
      if (id === 7) {
        const lit = j2 < 0.74 ? clamp01((blackoutAt(z, j) - f) / 3) : 0;
        r = WIN_DARK[0] + 2.3 * lit; g = WIN_DARK[1] + 1.6 * lit; b = WIN_DARK[2] + 0.7 * lit; k = 0.7 + 0.6 * j;
      } else if (id === 12) {
        const lit = j2 < 0.82 ? smooth((f - relightAt(z, j)) / 9) : 0;
        r = 0.62 + 1.9 * lit; g = 0.42 + 1.3 * lit; b = 0.3 + 0.45 * lit; k = 0.8 + 0.4 * j;
      }
      this.winMesh.setColorAt(i, this.c.setRGB(r * k, g * k, b * k));
    }
    this.winMesh.instanceColor!.needsUpdate = true;
    const lampK = id === 7 ? clamp01((798 - f) / 4) : id === 12 ? smooth((f - 1496) / 14) : 0;
    this.lampMat.color.setRGB(0.5 + 2.2 * lampK, 0.5 + 1.7 * lampK, 0.48 + 0.9 * lampK);
    const amber = id === 7 ? 0.9 * clamp01((798 - f) / 4) : 0.5 + 0.5 * Math.sin(t * 5);
    this.signalMat.color.setRGB(0.25 + 2.2 * amber, 0.16 + 1.3 * amber, 0.05);

    this.paper.visible = id === 2 || id === 3;
    if (this.paper.visible) {
      const u = (f - 96) / FPS;
      this.paper.position.set(-4.5 + u * 1.25, 0.12 + 0.3 * Math.abs(Math.sin(u * 2.6)), 4.2 + 0.4 * Math.sin(u * 0.9));
      this.paper.rotation.set(u * 2.4, u * 1.3, 0.4 * Math.sin(u * 3));
    }

    for (let v = 0; v < 4; v++) {
      const mesh = this.ghosts[v];
      mesh.visible = id === 12;
      if (!mesh.visible) continue;
      this.ghostPts[v].forEach((p, i) => {
        const s = f < p.at ? 0 : p.s * backOut((f - p.at) / 10);
        this.m4.compose(this.v.set(p.x, 0.02 + 0.03 * Math.sin(t * 2 + i * 1.7 + v), p.z), this.q.identity(), this.v2.set(s, s, s));
        mesh.setMatrixAt(i, this.m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    if (id === 2) {
      if (f < 207) {
        // standing in the middle of the road, back to camera, scanning the street
        this.hero.pose({ pos: [0.3, 0, 1.5], yaw: 0, expr: "neutral", headYaw: 0.75 * Math.sin((f - 96) * 0.07) });
      } else {
        const look = Math.sin((f - 207) * 0.09);
        this.hero.pose({ pos: [0.3, 0, 1.5], yaw: Math.PI, expr: f < 243 ? "neutral" : "nervous", headYaw: 0.4 * look,
          blink: Math.floor(f / 3) % 23 === 0 ? 1 : 0, handR: [0.21, 1.42, 0.1], handL: [-0.26, 0.74, 0.12] });
        this.hold(this.phone, "R", 0.02, 0.05, 0);
        this.phone.rotation.set(0, Math.PI, 0.15);
      }
    } else if (id === 3) {
      if (f < 366) {
        // victory dance, briefcase flung away on "No boss" (f349)
        const hop = 0.32 * Math.abs(Math.sin((f - 265) * Math.PI / 17));
        const pump = Math.sin((f - 265) * Math.PI / 8.5);
        const toss = smooth((f - 342) / 7);
        const pos: P3 = [0.3, hop, 1.5];
        this.hero.pose({ pos, yaw: Math.PI, expr: "relief_open", mouthOpen: 0.6, lean: -0.06,
          handR: [0.42, 1.6 + 0.12 * pump, 0.1],
          handL: f < 342 ? [-0.3, 0.72, 0.1] : [-0.3 - 0.25 * toss, 0.72 + 0.95 * toss, 0.1 + 0.1 * toss],
          footL: [-0.14, 0.04 + 0.05 * Math.max(0, pump), 0.05], footR: [0.14, 0.04 + 0.05 * Math.max(0, -pump), 0.05] });
        if (f < 349) {
          this.hold(this.briefcase, "L");
          this.briefcase.rotation.set(0, 0, 0.6 * toss);
        } else {
          const u = (f - 349) / FPS;
          this.briefcase.visible = true;
          this.briefcase.position.set(0.9 + 3.6 * u, 1.75 + 3.2 * u - 4.9 * u * u, 1.45 + 1.2 * u);
          this.briefcase.rotation.set(u * 9, u * 4, u * 11);
          if (this.briefcase.position.y < -0.5) this.briefcase.visible = false;
        }
      } else {
        // running down the centre line, arms in the air
        const u = f - 366, ph = u * 0.75;
        const x = 1.1 * Math.sin(u * 0.11), z = 3.2 + u * 0.24;
        const yaw = Math.atan2(1.1 * 0.11 * Math.cos(u * 0.11), 0.24);
        this.hero.pose({ pos: [x, 0.06 * Math.abs(Math.sin(ph)), z], yaw, expr: "relief_open", mouthOpen: 0.6, lean: 0.14,
          handL: [-0.5, 1.62 + 0.1 * Math.sin(ph), 0.05], handR: [0.5, 1.62 - 0.1 * Math.sin(ph), 0.05], ...this.walkFeet(ph, 0.3, 0.16) });
      }
    } else if (id === 12) {
      // alone -> noticing the strangers one by one -> a small smile
      const lookTo = f < 1398 ? 0 : f < 1426 ? 0.55 : f < 1449 ? -0.55 : f < 1486 ? 0.7 : 0.25 * Math.sin((f - 1486) * 0.05);
      const prev = f < 1398 ? 0 : f < 1426 ? 0 : f < 1449 ? 0.55 : f < 1486 ? -0.55 : 0.7;
      const start = f < 1398 ? 0 : f < 1426 ? 1398 : f < 1449 ? 1426 : f < 1486 ? 1449 : 1486;
      const hy = prev + (lookTo - prev) * smooth((f - start) / 8);
      this.hero.pose({ pos: [0, 0, 2], yaw: Math.PI, expr: f < 1398 ? "neutral" : f < 1500 ? "nervous" : "relief", headYaw: hy,
        headPitch: f < 1398 ? 0.16 : 0, blink: f < 1398 && Math.floor(f / 3) % 19 === 0 ? 1 : 0 });
    }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;

    // 1. Toggle active set only
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    // 2. Camera & light rig
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.15; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = s.set === "street" || s.set === "tower" || s.set === "plant" ? 46 : 28;
    const scm = this.sun.shadow.camera;
    scm.left = -Rr; scm.right = Rr; scm.top = Rr; scm.bottom = -Rr; scm.near = 10; scm.far = 320; scm.updateProjectionMatrix();

    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);

    const su = this.skyMat.uniforms;
    K.sky.c.forEach((hex, idx) => untone(hex, su["c" + idx].value));
    const elRad = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    su.e.value.set(elRad[1], elRad[2], elRad[3], elRad[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog;

    const night = s.light === "night";
    this.stars.visible = night; this.moon.visible = night;
    if (night) {
      this.stars.position.copy(cam.position);
      const md = id === 11 ? this.v.set(-0.55, 0.42, 0.72) : this.v.set(-0.32, 0.5, 0.8);
      this.moon.position.copy(cam.position).addScaledVector(md.normalize(), 660);
      this.moon.lookAt(cam.position);
    }

    // 3. Reset hero + props
    this.hero.root.visible = false;
    this.crown.visible = false;
    for (const o of [this.phone, this.briefcase, this.plunger, this.candle, this.mic]) o.visible = false;
    this.flame.scale.set(1, 1.7 + 0.25 * Math.sin(t * 23) + 0.15 * Math.sin(t * 37), 1);

    // 4. Pose per-shot actors & props
    if (s.set === "street") this.poseStreet(id, f, t);
    else if (id === 1) {
      // propped against the headboard asleep -> eyes snap open (f8) -> looks around the silent room
      const up = smooth((f - 7) / 5);
      const scan = f >= 42 ? 0.55 * Math.sin((f - 42) * 0.11) : 0.3 * smooth((f - 24) / 10);
      this.hero.pose({ pos: [-0.5, -0.2, 1.5], yaw: Math.PI, lean: -0.2 * (1 - up) + 0.03, expr: f < 8 ? "neutral" : "nervous",
        blink: f < 8 ? 1 : 0, headPitch: 0.3 * (1 - up), headYaw: scan,
        handL: [-0.22, 0.86 + 0.06 * up, 0.34], handR: [0.22, 0.86 + 0.06 * up, 0.34],
        footL: [-0.1, 0.74, 0.8], footR: [0.1, 0.74, 0.8] });
    } else if (id === 4) {
      // origin-locked treadmill: everything else scrolls
      const scroll = ((f - 410) * HWY_SPEED) / FPS + 1000;
      for (let i = 0; i < 80; i++) {
        const dz = (((i * 6 - scroll) % 300) + 300) % 300 - 150;
        this.m4.makeTranslation(i % 2 ? -3.2 : 3.2, 0.02, dz);
        this.hwyDashes.setMatrixAt(i, this.m4);
      }
      for (let i = 0; i < 24; i++) {
        const side = i % 2 ? -1 : 1;
        const dz = (((i * 12.5 - scroll) % 300) + 300) % 300 - 150;
        this.m4.makeTranslation(side * 7.4, 0, dz); this.hwyPoles.setMatrixAt(i, this.m4);
        const dz2 = (((i * 12.5 + 5 - scroll) % 300) + 300) % 300 - 150;
        const sc = 0.8 + 0.5 * hash(i * 3.3);
        this.m4.compose(this.v.set(side * (11 + 6 * hash(i * 1.7)), 0, dz2), this.q.identity(), this.v2.set(sc, sc, sc)); this.hwyTrees.setMatrixAt(i, this.m4);
      }
      for (const m of [this.hwyDashes, this.hwyPoles, this.hwyTrees]) m.instanceMatrix.needsUpdate = true;
      const by = 0.012 * Math.sin(t * 19) + 0.008 * Math.sin(t * 31);
      this.sportCar.position.set(0, by, 0);
      this.sportCar.rotation.set(0, 0.03 * Math.sin(t * 2.2), 0.01 * Math.sin(t * 7));
      const cheer = smooth((f - 436) / 8);
      this.hero.pose({ pos: [-0.4, -0.1 + by, -0.42], yaw: 0, lean: -0.05, expr: "relief_open", mouthOpen: 0.55, headYaw: 0.3,
        handL: [-0.14, 1.07, 0.5],
        handR: [0.14 + 0.3 * cheer, 1.07 + (0.62 + 0.06 * Math.sin(t * 16)) * cheer, 0.5 - 0.35 * cheer],
        footL: [-0.1, 0.45, 0.6], footR: [0.1, 0.45, 0.62] });
    } else if (s.set === "market") {
      const dark = id === 10;
      this.martLights.color.setScalar(dark ? 0.06 : 2.2);
      this.martSign.color.setScalar(dark ? 0.1 : 1);
      this.regSign.color.setScalar(dark ? 0.08 : 1);
      const rotAll = dark ? smooth((f - 950) / 46) : 0;
      for (let i = 0; i < this.prodCol.length; i++) {
        const k = clamp01(rotAll * 1.5 - 0.5 * hash(i * 3.9)), p = this.prodPts[i];
        this.products.setColorAt(i, this.c.copy(this.prodCol[i]).lerp(this.prodRot[i], k));
        // rotting boxes sag and slump sideways
        this.q.setFromEuler(this.e.set(0, 0, 0.5 * k * (hash(i * 6.7) - 0.5)));
        this.m4.compose(this.v.set(p.x, p.y + 0.025, p.z), this.q, this.v2.set(1 + 0.2 * k, p.sy * (1 - 0.5 * k), 1 + 0.2 * k));
        this.products.setMatrixAt(i, this.m4);
      }
      this.products.instanceColor!.needsUpdate = true;
      this.products.instanceMatrix.needsUpdate = true;
      this.stink.visible = dark;
      if (dark) {
        for (let i = 0; i < 12; i++) {
          const ph = (t * 0.32 + i / 12) % 1, sc = rotAll * (0.5 + 1.1 * ph) * (1 - ph * ph);
          this.m4.compose(this.v.set(-2.3 + 0.22 * Math.sin(t * 2 + i), 0.5 + 1.9 * ph, 2.4 + 2.6 * hash(i * 3.1)), this.q.identity(), this.v2.setScalar(Math.max(0.001, sc)));
          this.stink.setMatrixAt(i, this.m4);
        }
        this.stink.instanceMatrix.needsUpdate = true;
      }
      this.flies.visible = dark;
      this.cart.visible = !dark;
      if (!dark) {
        const z = cartZ(f), ph = f * 0.52;
        this.cart.position.set(0, 0, z);
        this.cart.rotation.set(0, 0.03 * Math.sin(f * 0.21), 0.012 * Math.sin(f * 1.3));
        this.hero.pose({ pos: [0, 0.03 * Math.abs(Math.sin(ph)), z + 0.92], yaw: Math.PI, lean: 0.14, expr: "relief",
          headYaw: 0.3 * Math.sin(f * 0.06), handL: [-0.2, 0.98, 0.4], handR: [0.2, 0.98, 0.4], ...this.walkFeet(ph, 0.16, 0.08) });
      } else {
        for (let i = 0; i < 14; i++) {
          const a = t * (5 + 3 * hash(i)) + i * 2.1, r = 0.16 + 0.22 * hash(i * 2.3);
          this.m4.makeTranslation(-2.25 + r * Math.sin(a) * 0.6, 1.05 + 0.75 * hash(i * 4.1) + 0.08 * Math.sin(a * 1.7), 3.0 + 1.8 * hash(i * 5.9) + r * Math.cos(a));
          this.flies.setMatrixAt(i, this.m4);
        }
        this.flies.instanceMatrix.needsUpdate = true;
        const flinch = smooth((f - 968) / 10);
        this.hero.pose({ pos: [-1.05, 0, 3.55], yaw: 2.85, lean: -0.1 * flinch, expr: flinch > 0.5 ? "pained" : "nervous", headYaw: 0.55,
          handR: [0.44, 1.02, 0.3], handL: [-0.26 + 0.22 * flinch, 0.74 + 0.62 * flinch, 0.12 + 0.1 * flinch] });
        this.hold(this.candle, "R", 0, 0.02, 0);
      }
    } else if (s.set === "mansion") {
      const dark = id === 13;
      if (dark) this.manWin.color.setRGB(...WIN_DARK); else this.manWin.color.setRGB(2.0, 1.4, 0.6);
      this.suitcase.visible = id === 6 && f < 693;
      this.suitcase.position.set(0.75, 0.17, -5.4);
      if (id === 6 && f < 693) {
        // tiny figure at the foot of the drive, arms thrown wide at his new house
        const hop = 0.1 * Math.abs(Math.sin((f - 580) * 0.2));
        const arms = smooth((f - 590) / 14);
        this.hero.pose({ pos: [0, hop, -5.5], yaw: 0, expr: "grin", headPitch: -0.3,
          handL: [-0.26 - 0.3 * arms, 0.72 + 0.95 * arms, 0.1], handR: [0.26 + 0.3 * arms, 0.72 + 0.95 * arms, 0.1] });
      } else if (id === 6) {
        this.crown.visible = true;
        const tk = talkK(f);
        const raise = smooth((f - 693) / 9);
        this.hero.pose({ pos: [0, 0.45, 3.2], yaw: Math.PI, expr: "grin", mouthOpen: tk, headPitch: -0.14, lean: -0.05,
          handR: [0.36, 0.9 + 0.68 * raise + 0.03 * Math.sin(f * 0.4), 0.16], handL: [-0.24, 0.92, 0.1] });
        this.hold(this.plunger, "R", 0, -0.12, 0);
        this.plunger.rotation.set(0, 0, -0.18);
      } else {
        // the king, sitting alone on his own doorstep
        this.crown.visible = true;
        const sigh = smooth((f - 1640) / 30);
        this.hero.pose({ pos: [0, -0.25, 2.95], yaw: Math.PI, lean: 0.16 + 0.08 * sigh, expr: "neutral", headPitch: 0.12 + 0.2 * sigh,
          blink: Math.floor(f / 3) % 29 === 0 || sigh > 0.9 ? 1 : 0, headYaw: 0.35 * (1 - sigh) * Math.sin((f - 1582) * 0.05),
          handL: [-0.15, 0.86, 0.3], handR: [0.15, 0.86, 0.3], footL: [-0.13, 0.56, 0.52], footR: [0.13, 0.56, 0.52] });
        this.candle.visible = true;
        this.candle.position.set(0.7, 0.46, 3.05);
      }
    } else if (id === 8) {
      const die = 1 - smooth((f - 826) / 48);
      this.puffs.forEach((p, i) => {
        const tw = i % 2, ph = (t * 0.33 + i / 9) % 1;
        const x = (tw ? 7.0 : -0.5) + 1.2 * Math.sin(i * 2.4) * ph + 1.5 * ph, z = tw ? 57 : 48;
        const sc = (1.5 + 2.8 * ph) * die * (1 - 0.55 * ph);
        p.position.set(x, 16.6 + 9 * ph, z);
        p.scale.setScalar(Math.max(0.001, sc));
      });
      const pw = clamp01((846 - f) / 5);
      this.plantWin.color.setRGB(WIN_DARK[0] + 2.2 * pw, WIN_DARK[1] + 1.6 * pw, WIN_DARK[2] + 0.7 * pw);
      const bk = clamp01((858 - f) / 4) * (0.5 + 0.5 * Math.sin(t * 6));
      this.plantBeacon.color.setRGB(0.25 + 2.8 * bk, 0.03 + 0.2 * bk, 0.03 + 0.15 * bk);
      this.hardHat.position.set(0.7, 0.0, 6.0);
      this.hardHat.rotation.set(0.05, 0.6, 0.28 * Math.sin((f - 818) * 0.24) * Math.exp(-(f - 818) / 34));
    } else if (id === 9) {
      // tap: full stream -> thread -> two last drops -> nothing; frantic hand on the knob
      const flow = 1 - smooth((f - 897) / 14);
      this.stream.visible = flow > 0.02;
      this.stream.scale.set(Math.max(0.05, flow), 1, Math.max(0.05, flow));
      [918, 932].forEach((d0, i) => {
        const u = (f - d0 + 6) / FPS, d = this.drops[i];
        d.visible = u >= 0 && u < 0.24;
        d.position.set(0, 1.2 - 4.9 * u * u * 0.8, 1.04);
      });
      const pos: P3 = [-0.85, 0, 0.5], yaw = 2.3;
      const twist = 0.035 * Math.sin(f * 0.9);
      this.hero.pose({ pos, yaw, lean: 0.12, expr: "nervous", headYaw: f < 915 ? -0.7 : -0.7 + 0.9 * smooth((f - 915) / 10), headPitch: f < 915 ? 0.2 : 0.05,
        handR: toLocal(pos, yaw, [-0.16 + twist, 1.07, 1.24]), handL: toLocal(pos, yaw, [-0.5, 0.99, 0.82]) });
      this.candle.visible = true;
      this.candle.position.set(0.62, 0.965, 0.92);
    } else if (id === 11) {
      const blink = 0.5 + 0.5 * Math.sin(t * 4.2);
      this.beacon.color.setRGB(0.3 + 3.0 * blink, 0.03 + 0.2 * blink, 0.03 + 0.15 * blink);
      this.scope.map = scopeTex(f >= 1186 ? Math.floor(f / 2) % 4 : 0);
      this.scope.color.setScalar(f >= 1186 ? 1.6 : 0.5);
      if (f < 1130) {
        const y = climbY(f), ph = (f - 1022) * 0.42, a = 0.2 * Math.sin(ph);
        this.hero.pose({ pos: [0, y, -0.82], yaw: 0, lean: 0.1, expr: "stern", headPitch: -0.35,
          handL: [-0.17, 1.52 + a, 0.3], handR: [0.17, 1.52 - a, 0.3], footL: [-0.12, 0.14 - a, 0.26], footR: [0.12, 0.14 + a, 0.26] });
      } else {
        const tk = talkK(f);
        const listen = smooth((f - 1188) / 12);
        const give = smooth((f - 1262) / 24);
        this.hero.pose({ pos: [0, TOWER_TOP + 0.08, 0], yaw: Math.PI, lean: 0.08 * listen + 0.1 * give,
          expr: give > 0.5 ? "neutral" : "nervous", mouthOpen: tk,
          headYaw: -0.5 * listen * (1 - give), headPitch: 0.3 * give, blink: give > 0.8 ? 1 : 0,
          handR: [0.12 + 0.14 * listen, 1.22 - 0.3 * listen - 0.2 * give, 0.2], handL: [-0.26, 0.74 + 0.5 * listen * (1 - give), 0.12 + 0.06 * listen] });
        this.hold(this.mic, "R", 0, 0.05, -0.02);
      }
    }

    return focus;
  }
}
