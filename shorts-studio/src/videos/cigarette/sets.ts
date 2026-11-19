// Modular 3D set registry for "The Beggar's Gutter Trick": Seville street, hand-rolling factory, Crimean war camp,
// tobacco boss's office and the leaky barn where the rolling machine is built. Only the active shot's set Group is
// visible per frame; the cast lives on the world root and is posed per shot. Readable props (price board, slate,
// poster, newspaper, counter) use unlit MeshBasicMaterial faces on NOINK so they stay legible under every grade.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex, rep, cobbleHD, planksHD, facadeHD } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK, LIGHT_ATMOS } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D, RigPose, RigStyle } from "../core/rig25d";
import {
  createOverheadSpotlight, createRainParticles, createWetAsphaltReflections, createCrashDebrisSparks,
  createFlipCounterProp, createStylizedCloudDeck,
  OverheadSpotlightCone, RainParticleSystem, WetAsphaltReflections, CrashDebrisSparks, FlipCounterProp, StylizedCloudDeck,
} from "../core/environment";
import { BEGGAR_STEP, CARRIAGE_X, CIGAR_POS, FPS, SHOTS, V3, beggarPos, camAt, carZ, flyAngle, lerp, smooth } from "./story";

// ---------------- small builders ----------------
const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 18) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
const tex = (key: string, t: THREE.Texture) => lam(key, () => ({ map: t }));
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: true });
/** deterministic 0..1 hash (stable across renders / chunks) */
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
/** world target -> rig-local target for a rig at `root` turned by `yaw` (rig forward = local +z) */
const toLocal = (root: V3, yaw: number, w: V3): V3 => {
  const dx = w[0] - root[0], dz = w[2] - root[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, w[1] - root[1], dx * s + dz * c];
};
const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** Unlit readable prop: textured face plane + lam backing card (the card still gets an ink outline) */
const sign = (w: number, h: number, t: THREE.Texture, backHex = "#f4efe3", depth = 0.025) => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, depth, col("cg_sign_back_" + backHex, backHex), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  face.position.z = depth / 2 + 0.002;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};

// ---------------- painted textures ----------------
const shopSignTex = () => ctex("cg_shop", 512, 128, (g) => {
  g.fillStyle = "#1f3b2c"; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#d8b25a"; g.lineWidth = 8; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = "#f2d27e"; g.font = "bold 74px serif"; g.textAlign = "center"; g.fillText("TABACOS", 256, 92);
});
const priceTex = () => ctex("cg_price", 320, 400, (g) => {
  g.fillStyle = "#2a2422"; g.fillRect(0, 0, 320, 400);
  g.strokeStyle = "#c9a24a"; g.lineWidth = 8; g.strokeRect(10, 10, 300, 380);
  g.fillStyle = "#f6efe0"; g.textAlign = "center";
  g.font = "bold 44px serif"; g.fillText("CIGARS", 160, 78);
  g.fillStyle = "#c9a24a"; g.fillRect(40, 100, 240, 4);
  g.fillStyle = "#f6efe0"; g.font = "bold 92px serif"; g.fillText("8", 130, 220);
  g.font = "bold 40px serif"; g.fillText("REALES", 200, 205);
  g.font = "italic 30px serif"; g.fillText("each", 160, 268);
  g.fillStyle = "#e0544a"; g.font = "bold 34px sans-serif"; g.fillText("FOR GENTLEMEN", 160, 340);
});
const paperTex = () => ctex("cg_scrap", 256, 192, (g, r) => {
  g.fillStyle = "#e9dcbc"; g.fillRect(0, 0, 256, 192);
  g.fillStyle = "rgba(60,40,30,0.55)";
  for (let y = 18; y < 186; y += 13) for (let x = 10; x < 246; x += 6 + r() * 22) g.fillRect(x, y, 4 + r() * 16, 4);
  g.fillStyle = "rgba(140,100,60,0.25)"; g.beginPath(); g.ellipse(190, 140, 40, 28, 0.4, 0, 7); g.fill();
});
const slateTex = () => ctex("cg_slate", 384, 288, (g) => {
  g.fillStyle = "#2b3130"; g.fillRect(0, 0, 384, 288);
  g.strokeStyle = "#8a6440"; g.lineWidth = 18; g.strokeRect(9, 9, 366, 270);
  g.fillStyle = "#f4f1e6"; g.textAlign = "center";
  g.font = "bold 132px sans-serif"; g.fillText("4", 120, 190);
  g.font = "bold 54px sans-serif"; g.fillText("/ MINUTE", 245, 168);
  g.font = "28px sans-serif"; g.fillText("BY HAND", 192, 244);
});
const factoryBannerTex = () => ctex("cg_fab", 1024, 160, (g) => {
  g.fillStyle = "#7a2b25"; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = "#f2d27e"; g.font = "bold 88px serif"; g.textAlign = "center"; g.fillText("REAL FÁBRICA DE TABACOS", 512, 112);
});
const newsTex = () => ctex("cg_news", 384, 288, (g, r) => {
  g.fillStyle = "#e8e0c8"; g.fillRect(0, 0, 384, 288);
  g.fillStyle = "#1d1a18"; g.textAlign = "center"; g.font = "bold 46px serif"; g.fillText("WAR NEWS", 192, 54);
  g.fillRect(16, 66, 352, 4);
  g.font = "bold 26px serif"; g.fillText("SIEGE OF SEBASTOPOL", 192, 102);
  g.fillStyle = "rgba(29,26,24,0.6)";
  for (let y = 120; y < 280; y += 12) for (let x = 16; x < 368; x += 8 + r() * 30) g.fillRect(x, y, 6 + r() * 20, 4);
});
const londonTex = () => ctex("cg_london", 320, 96, (g) => {
  g.fillStyle = "#d9c9a2"; g.fillRect(0, 0, 320, 96);
  g.fillStyle = "#2a1d14"; g.font = "bold 50px serif"; g.textAlign = "center"; g.fillText("HOME  →", 160, 66);
});
const posterTex = () => ctex("cg_poster", 512, 704, (g) => {
  g.fillStyle = "#efe3c2"; g.fillRect(0, 0, 512, 704);
  g.strokeStyle = "#2a1d14"; g.lineWidth = 10; g.strokeRect(16, 16, 480, 672);
  g.fillStyle = "#b8262f"; g.textAlign = "center"; g.font = "bold 70px serif"; g.fillText("REWARD", 256, 112);
  g.fillStyle = "#2a1d14"; g.font = "bold 132px serif"; g.fillText("$75,000", 256, 268);
  g.font = "bold 40px serif"; g.fillText("TO ANY MAN WHO", 256, 360); g.fillText("BUILDS A", 256, 410);
  g.fillStyle = "#b8262f"; g.font = "bold 58px serif"; g.fillText("ROLLING", 256, 486); g.fillText("MACHINE", 256, 548);
  g.fillStyle = "#2a1d14"; g.font = "italic 30px serif"; g.fillText("Richmond, Virginia · 1875", 256, 636);
});
const ordersTex = () => ctex("cg_orders", 256, 96, (g) => {
  g.fillStyle = "#b8262f"; g.fillRect(0, 0, 256, 96);
  g.fillStyle = "#fff4dc"; g.font = "bold 48px serif"; g.textAlign = "center"; g.fillText("ORDERS", 128, 64);
});
const nightWindowTex = () => ctex("cg_nightwin", 512, 420, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, "#0b1430"); gr.addColorStop(1, "#2a2e52");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 420);
  g.fillStyle = "#fff6d8"; for (let i = 0; i < 40; i++) g.fillRect(r() * 512, r() * 200, 2, 2);
  g.fillStyle = "#14182a";
  for (let x = 0; x < 512; x += 40 + r() * 40) { const h = 90 + r() * 140; g.fillRect(x, 420 - h, 36 + r() * 30, h); }
  for (const x of [90, 300, 420]) { g.fillRect(x, 120, 18, 300); }
  g.fillStyle = "rgba(170,170,190,0.35)"; for (const x of [99, 309, 429]) { g.beginPath(); g.ellipse(x + 20, 100, 30, 14, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 50, 80, 36, 16, 0, 0, 7); g.fill(); }
  g.fillStyle = "#ffcf6e"; for (let i = 0; i < 70; i++) g.fillRect(r() * 512, 260 + r() * 150, 5, 7);
});
const clockFaceTex = () => ctex("cg_clock", 256, 256, (g) => {
  g.fillStyle = "#f3ead2"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
  g.strokeStyle = "#2a1d14"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#2a1d14"; g.font = "bold 34px serif"; g.textAlign = "center";
  ["XII", "III", "VI", "IX"].forEach((s, i) => { const a = i * Math.PI / 2; g.fillText(s, 128 + Math.sin(a) * 88, 140 - Math.cos(a) * 88); });
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 52); g.stroke();
  g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(188, 150); g.stroke();
});

// ---------------- props ----------------
/** Single rolled stick (paper tube, tan end): long axis along +x, centred */
const stickGeo = new THREE.CylinderGeometry(0.0105, 0.0105, 0.1, 10).rotateZ(Math.PI / 2);
const makeStick = () => {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(stickGeo, col("cg_paper", "#f4efe2"));
  const tip = cyl(0.0108, 0.0108, 0.012, col("cg_tip", "#8a5a32"), 0.047, 0, 0, 10);
  tip.rotation.z = Math.PI / 2;
  g.add(paper, tip);
  return g;
};
const makeCigar = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.13, 6, 12).rotateZ(Math.PI / 2), col("cg_cigar", "#6b3f22"));
  body.castShadow = true;
  const band = cyl(0.024, 0.024, 0.018, col("cg_band", "#d9a93a"), -0.04, 0, 0, 12); band.rotation.z = Math.PI / 2;
  const ash = cyl(0.02, 0.021, 0.02, col("cg_ash", "#9a958c"), 0.085, 0, 0, 10); ash.rotation.z = Math.PI / 2;
  g.add(body, band, ash);
  return g;
};
const makeCoin = () => {
  const c = cyl(0.03, 0.03, 0.006, col("cg_coin", "#c9853a"), 0, 0, 0, 16);
  c.rotation.x = Math.PI / 2;
  const g = new THREE.Group(); g.add(c); return g;
};
/** Spoked iron-rimmed carriage wheel (axis along x) */
const makeWheel = (r: number) => {
  const g = new THREE.Group();
  const rimMat = col("cg_rim", "#2b2420"), spokeMat = col("cg_spoke", "#c9a24a");
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 8, 28), rimMat);
  rim.rotation.y = Math.PI / 2; rim.castShadow = true;
  g.add(rim);
  for (let i = 0; i < 8; i++) {
    const s = box(0.035, r * 2, 0.035, spokeMat, 0, 0, 0);
    s.rotation.x = (i / 8) * Math.PI;
    g.add(s);
  }
  const hub = cyl(0.08, 0.08, 0.12, spokeMat, 0, 0, 0, 12); hub.rotation.z = Math.PI / 2; g.add(hub);
  return g;
};
const makeHorse = () => {
  const g = new THREE.Group();
  const coat = col("cg_horse", "#7a4a2a"), mane = col("cg_mane", "#2a1a12");
  g.add(box(0.5, 0.55, 1.5, coat, 0, 1.25, 0));
  const neck = box(0.3, 0.75, 0.32, coat, 0, 1.65, 0.75); neck.rotation.x = 0.55; g.add(neck);
  g.add(box(0.26, 0.28, 0.6, coat, 0, 1.95, 1.12), box(0.08, 0.5, 0.36, mane, 0, 1.75, 0.66));
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.17, 0.6], [0.17, 0.6], [-0.17, -0.6], [0.17, -0.6]]) {
    const p = new THREE.Group(); p.position.set(x, 1.0, z);
    p.add(box(0.12, 0.98, 0.14, coat, 0, -0.49, 0), box(0.14, 0.1, 0.17, mane, 0, -0.96, 0.01));
    g.add(p); legs.push(p);
  }
  const tail = box(0.08, 0.6, 0.1, mane, 0, 1.15, -0.85); tail.rotation.x = -0.4; g.add(tail);
  return { g, legs };
};
const makeTent = (w = 2.4, d = 3.0, h = 1.9) => {
  const geo = new THREE.CylinderGeometry(w * 0.6, w * 0.6, d, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI);
  const m = new THREE.Mesh(geo, col("cg_canvas", "#d9cba6"));
  m.scale.set(1, h / (w * 0.9), 1);
  m.position.y = h * 0.42;
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
};

// ---------------- cast styles ----------------
const SKINS = ["#f3c9a0", "#e2b085", "#c98f63", "#f5d4b3", "#d9a57c"];
const DRAB = ["#7a6a55", "#5d6a5a", "#806048", "#6a5a72", "#8a7a62", "#5a5048"];
const WORK = ["#7d4a5a", "#4a6a8a", "#8a5a3a", "#5a7a4a", "#9a6a4a", "#6a4a7a", "#4a7a7a", "#a0584a"];
const HAIR = ["#2a1d18", "#4a2e1e", "#1d1a18", "#6a3e22", "#3a2a1e"];

export class MultiSetWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private clouds: StylizedCloudDeck;
  private sunCache = new Map<number, THREE.Vector3>();
  private m4 = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private dummy = new THREE.Object3D();

  // cast
  private beggar: HeroRig25D;
  private rich: HeroRig25D;
  private poor: HeroRig25D[] = [];
  private workers: HeroRig25D[] = [];
  private soldiers: HeroRig25D[] = [];
  private boss: HeroRig25D;
  private james: HeroRig25D;
  // street
  private carriage = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private horseLegs: THREE.Group[] = [];
  private horse!: THREE.Group;
  private cigar: THREE.Group;
  private cigarHand: THREE.Group;
  private crumbs: THREE.InstancedMesh;
  private crate = new THREE.Group();
  private scrap: THREE.Mesh;
  private rollTube: THREE.Group;
  private handStick: THREE.Group;
  private coin: THREE.Group;
  private flakes: THREE.InstancedMesh;
  // factory
  private slate!: THREE.Group;
  // camp
  private flames: THREE.Mesh[] = [];
  private fireLight = new THREE.PointLight("#ff9a4a", 0, 14, 1.4);
  private muzzle!: THREE.Mesh;
  private muzzleLight = new THREE.PointLight("#ffd28a", 0, 40, 1.2);
  private smoke!: THREE.InstancedMesh;
  private sparks: CrashDebrisSparks;
  private campLamp: OverheadSpotlightCone;
  private news: THREE.Group;
  private kitbag: THREE.Mesh;
  // office
  private officeLamp: OverheadSpotlightCone;
  private poster = new THREE.Group();
  private posterRoll!: THREE.Mesh;
  private phoneBase = new THREE.Group();
  private earpiece: THREE.Group;
  private counter: FlipCounterProp;
  private pendulum = new THREE.Group();
  // barn
  private barnLamp: OverheadSpotlightCone;
  private rain: RainParticleSystem;
  private wet: WetAsphaltReflections;
  private flywheel = new THREE.Group();
  private bobbin = new THREE.Group();
  private gears: THREE.Group[] = [];
  private cutter!: THREE.Mesh;
  private outSticks: THREE.InstancedMesh;
  private lastStick: THREE.Group;
  private drip!: THREE.Mesh;
  private wallEar: THREE.Group;
  private wrench: THREE.Group;
  private doorGlow!: THREE.Mesh;

  constructor() {
    const R = this.root;
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
    R.add(this.sky);
    this.clouds = createStylizedCloudDeck(R, { count: 12, radius: 260, minY: 60, maxY: 120, seed: 23 });
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    for (const name of ["street", "factory", "camp", "office", "barn"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    // ---- cast ----
    this.beggar = new HeroRig25D(R, { skin: "#d9a57c", jacket: "#8a7a62", hair: "#3a2a1e", torn: true, seed: 7, hat: "beanie", hatColor: "#6a4a2e" });
    this.rich = new HeroRig25D(R, { skin: "#f5d4b3", jacket: "#2b2a45", vest: "#e2c25a", tie: "#b8262f", hair: "#4a2e1e", hat: "tophat", seed: 11 });
    for (let k = 0; k < 4; k++) {
      const st: RigStyle = { skin: SKINS[(k + 2) % SKINS.length], jacket: DRAB[k % DRAB.length], hair: HAIR[k % HAIR.length], torn: k % 2 === 0, seed: 20 + k,
        ...(k === 1 ? { apron: "#e9dcbc" } : {}), ...(k === 3 ? { hat: "beanie" as const, hatColor: "#5a4632" } : {}) };
      this.poor.push(new HeroRig25D(R, st));
    }
    for (let k = 0; k < 16; k++) {
      this.workers.push(new HeroRig25D(R, { skin: SKINS[k % SKINS.length], jacket: WORK[(k * 3) % WORK.length], apron: k % 3 === 2 ? "#d9cba6" : "#f1ead8",
        hair: HAIR[(k * 2) % HAIR.length], collar: "#f4efe3", seed: 50 + k }));
    }
    for (let k = 0; k < 3; k++) {
      this.soldiers.push(new HeroRig25D(R, { skin: SKINS[(k + 1) % SKINS.length], jacket: "#b5262e", collar: "#f1ead8", vest: k === 2 ? "#e6dcc4" : undefined,
        hair: HAIR[k], hat: "police", seed: 80 + k }));
    }
    this.boss = new HeroRig25D(R, { skin: "#f3c9a0", jacket: "#1f2230", vest: "#7a2b25", tie: "#e2c25a", collar: "#ffffff", hair: "#6a6a6a", hat: "tophat", seed: 91 });
    this.james = new HeroRig25D(R, { skin: "#f3c9a0", jacket: "#e8e0cc", vest: "#5a3e2a", collar: "#ffffff", hair: "#8a4a22", seed: 97 });

    // ---- loose props (world root, positioned per shot) ----
    this.cigar = makeCigar(); this.sets.street.add(this.cigar);
    this.cigarHand = makeCigar(); R.add(this.cigarHand);
    this.handStick = makeStick(); this.handStick.scale.setScalar(1.6); R.add(this.handStick);
    this.coin = makeCoin(); R.add(this.coin);
    this.news = new THREE.Group();
    const newsFace = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), new THREE.MeshBasicMaterial({ map: newsTex(), side: THREE.DoubleSide }));
    newsFace.layers.set(NOINK); newsFace.rotation.x = -0.9;
    this.news.add(newsFace); R.add(this.news);
    this.kitbag = box(0.28, 0.42, 0.22, col("cg_kitbag", "#c9b98a"), 0, 0, 0); R.add(this.kitbag);
    this.earpiece = new THREE.Group();
    this.earpiece.add(cyl(0.02, 0.028, 0.12, col("cg_bakelite", "#16130f"), 0, 0, 0, 12));
    R.add(this.earpiece);
    this.wallEar = new THREE.Group();
    this.wallEar.add(cyl(0.02, 0.028, 0.12, col("cg_bakelite", "#16130f"), 0, 0, 0, 12));
    R.add(this.wallEar);
    this.wrench = new THREE.Group();
    this.wrench.add(box(0.03, 0.26, 0.015, col("cg_steel", "#9aa3ad"), 0, 0.1, 0), box(0.07, 0.04, 0.015, col("cg_steel", "#9aa3ad"), 0, 0.24, 0));
    R.add(this.wrench);
    this.lastStick = makeStick(); this.lastStick.scale.setScalar(1.0); R.add(this.lastStick);

    // crumbs / flakes / smoke / output sticks (instanced, NOINK)
    this.crumbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.006, 0.012), col("cg_leaf", "#6b3f22"), 40);
    this.crumbs.layers.set(NOINK); this.sets.street.add(this.crumbs);
    this.flakes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.014, 0.01), new THREE.MeshBasicMaterial({ color: "#7a4a26", side: THREE.DoubleSide }), 60);
    this.flakes.layers.set(NOINK); this.flakes.frustumCulled = false; R.add(this.flakes);
    this.scrap = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), new THREE.MeshBasicMaterial({ map: paperTex(), side: THREE.DoubleSide }));
    this.scrap.layers.set(NOINK); R.add(this.scrap);
    this.rollTube = makeStick(); this.rollTube.scale.setScalar(1.4); R.add(this.rollTube);

    this.buildStreet();
    this.buildFactory();
    this.sparks = createCrashDebrisSparks(this.sets.camp, { sparkCount: 40, debrisCount: 1, seed: 7 });
    this.campLamp = createOverheadSpotlight(this.sets.camp, { pos: [-1.3, 3.1, 1.7], targetPos: [-1.0, 0, 1.0], color: "#ffcf86", intensity: 22, withHood: true });
    this.buildCamp();
    this.officeLamp = createOverheadSpotlight(this.sets.office, { pos: [0, 3.2, 0.35], targetPos: [0, 0.8, 0.35], color: "#ffd9a0", intensity: 30, withHood: true });
    this.counter = createFlipCounterProp(this.sets.office, { pos: [-0.8, 0.8, -0.22], yaw: Math.PI, scale: 0.75, header: "FAILED MACHINES", beforeValue: "41", afterValue: "42", accentColor: "#b8262f" });
    this.buildOffice();
    this.barnLamp = createOverheadSpotlight(this.sets.barn, { pos: [0.25, 3.05, 2.7], targetPos: [0.2, 0.9, 2.6], color: "#ffc77a", intensity: 26, withHood: true });
    this.rain = createRainParticles(R, { count: 520, areaW: 26, areaH: 14, areaD: 30, excludeBox: { min: [-4.1, -1, -1.1], max: [4.1, 6, 8.1] } });
    this.wet = createWetAsphaltReflections(this.sets.barn, 6);
    this.outSticks = new THREE.InstancedMesh(stickGeo, col("cg_paper", "#f4efe2"), 120);
    this.outSticks.castShadow = true; this.outSticks.frustumCulled = false;
    this.sets.barn.add(this.outSticks);
    this.buildBarn();
  }

  // ======================= SETS =======================
  private buildStreet() {
    // Cobbled street along z (x -3.2..3.2), raised pavements to +-4.4, whitewashed facades on both sides, the cathedral
    // bell tower closing the vista at z ~ 98. The gutter channel runs down x = -1.6 (where the cigar lands).
    const S = this.sets.street;
    const cob = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 130), tex("cg_cobble", rep(cobbleHD(), 6.4 / 8 * 2, 130 / 8 * 2)));
    cob.rotation.x = -Math.PI / 2; cob.position.set(0, 0, 33); cob.receiveShadow = true; S.add(cob);
    S.add(box(0.34, 0.012, 130, col("cg_gutter", "#7d7064"), -1.6, 0.004, 33, false));
    for (const sx of [-1, 1]) S.add(box(1.2, 0.12, 130, col("cg_pave", "#d8cbb2"), sx * 3.8, 0.06, 33, false));
    S.add(box(60, 0.05, 60, col("cg_plaza", "#cdbd9f"), 0, -0.02, 125, false));
    const walls = ["#f6efe0", "#f3e6c8", "#f1dcb4", "#f6efe0", "#efe2d2"], trims = ["#d9a43a", "#c2562f", "#3f7a52"];
    const facTex = [
      facadeHD("cg_facA", 6, 7, { wall: "#f6efe0", shutter: "#3f7a52", door: true }),
      facadeHD("cg_facB", 6, 7, { wall: "#f1dcb4", shutter: "#7a3f2b", door: true }),
    ];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 17; i++) {
        const z = -18 + i * 6, h = 6 + ((i * 7 + (sx > 0 ? 3 : 0)) % 4) * 0.6;
        const g = new THREE.Group();
        g.add(box(4, h, 6, col("cg_wall" + walls[(i + (sx > 0 ? 2 : 0)) % walls.length], walls[(i + (sx > 0 ? 2 : 0)) % walls.length]), sx * 2, h / 2, 0, false));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(6, Math.min(h, 7)), tex("cg_fac" + ((i + (sx > 0 ? 1 : 0)) % 2), facTex[(i + (sx > 0 ? 1 : 0)) % 2]));
        face.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; face.position.set(-0.005 * sx, Math.min(h, 7) / 2, 0); face.receiveShadow = true;
        g.add(face);
        g.add(box(0.25, 0.3, 6.05, col("cg_trim" + i % 3, trims[i % 3]), -0.1 * sx, h - 0.15, 0, false));
        // iron balcony with flower pots
        if (i % 2 === 0) {
          g.add(box(0.7, 0.08, 1.8, col("cg_iron", "#2a2420"), -0.35 * sx, 3.0, 0.6), box(0.04, 0.7, 1.8, col("cg_iron", "#2a2420"), -0.68 * sx, 3.38, 0.6));
          for (const dz of [0.05, 0.6, 1.15]) {
            g.add(cyl(0.11, 0.08, 0.18, col("cg_pot", "#b9583a"), -0.4 * sx, 3.13, dz, 10));
            const fl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), col("cg_gera", dz > 0.5 ? "#d8323f" : "#e86a9a")); fl.position.set(-0.4 * sx, 3.32, dz); g.add(fl);
          }
        }
        g.position.set(sx * 4.4, 0, z);
        S.add(g);
      }
    }
    // orange trees in pavement planters
    for (const [x, z] of [[3.75, 3], [-3.75, 15], [3.75, 21], [-3.75, 33], [3.75, 39], [-3.75, 51]] as [number, number][]) {
      const t = new THREE.Group();
      t.add(cyl(0.08, 0.11, 1.5, col("cg_bark", "#6b4a2e"), 0, 0.75, 0, 8));
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), col("cg_orleaf", "#3f8a3a")); crown.position.y = 1.95; crown.castShadow = true; t.add(crown);
      for (let k = 0; k < 7; k++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), col("cg_orange", "#f39a1e")); o.position.set(Math.sin(k * 2.3) * 0.7, 1.7 + (k % 3) * 0.25, Math.cos(k * 2.3) * 0.7); t.add(o); }
      t.position.set(x, 0.12, z); S.add(t);
    }
    // the cathedral bell tower at the end of the street
    const tw = new THREE.Group(), ochre = col("cg_tower", "#d9a46a"), ochreDk = col("cg_tower_dk", "#b97f4a");
    tw.add(box(7, 34, 7, ochre, 0, 17, 0), box(6, 7, 6, ochreDk, 0, 37.5, 0), box(4.4, 5, 4.4, ochre, 0, 43.5, 0));
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 8), col("cg_spire", "#c97f3a")); spire.position.y = 49; tw.add(spire);
    for (let k = 0; k < 6; k++) tw.add(box(7.1, 0.3, 7.1, ochreDk, 0, 5 + k * 5.4, 0));
    tw.position.set(1.5, 0, 112); S.add(tw);
    // cigar shop (right side, z 10..13): dark wood front, window, TABACOS sign, price board
    const shop = new THREE.Group();
    shop.add(box(0.15, 2.6, 3.2, col("cg_shopwood", "#3a2418"), 0, 1.3, 0));
    shop.add(box(0.1, 1.3, 1.6, glow(0.55, 0.42, 0.25), -0.06, 1.35, -0.55));
    const ss = sign(2.6, 0.65, shopSignTex(), "#1f3b2c", 0.05); ss.g.rotation.y = -Math.PI / 2; ss.g.position.set(-0.12, 2.95, 0); shop.add(ss.g);
    const pb = sign(0.48, 0.6, priceTex(), "#2a2422", 0.03); pb.g.rotation.y = -Math.PI / 2; pb.g.position.set(-0.16, 2.0, 0.85); shop.add(pb.g);
    for (let k = 0; k < 5; k++) { const c = makeCigar(); c.position.set(-0.13, 1.1 + (k % 2) * 0.03, -1.0 + k * 0.18); c.rotation.y = Math.PI / 2; shop.add(c); }
    shop.position.set(4.32, 0, 11.4); S.add(shop);
    // free butts on the cobbles by the right curb (shot 5 tilt-down target)
    for (let k = 0; k < 6; k++) {
      const b = makeCigar(); b.scale.set(0.45 + 0.15 * hash(k), 1, 1);
      b.position.set(2.65 + 0.25 * hash(k * 3.1), 0.03, 11.3 + 0.5 * hash(k * 7.7)); b.rotation.y = hash(k * 1.7) * 3; S.add(b);
    }
    // beggar's step + crate "desk"
    S.add(box(1.2, 0.35, 1.0, col("cg_step", "#cbb79a"), -3.65, 0.175, BEGGAR_STEP[2]));
    this.crate.add(box(0.5, 0.42, 0.6, col("cg_crate", "#a8763e"), 0, 0.21, 0));
    this.crate.add(box(0.52, 0.04, 0.62, col("cg_crate_dk", "#7a5228"), 0, 0.3, 0));
    for (let k = 0; k < 9; k++) { const b = makeCigar(); b.scale.set(0.4 + 0.2 * hash(k), 1, 1); b.position.set(-0.12 + 0.1 * hash(k * 2.2), 0.445, -0.2 + 0.06 * k); b.rotation.y = hash(k) * 2; this.crate.add(b); }
    this.crate.position.set(-2.85, 0, BEGGAR_STEP[2]);
    S.add(this.crate);
    // carriage (open calèche) + horse; moves along z
    const lac = col("cg_lacquer", "#1d1a24"), gold = col("cg_gold", "#d9a93a"), red = col("cg_seat", "#8e2a2a");
    this.carriage.add(box(1.5, 0.55, 2.1, lac, 0, 0.98, 0), box(1.54, 0.06, 2.14, gold, 0, 1.27, 0));
    this.carriage.add(box(1.3, 0.14, 0.7, red, 0, 1.2, -0.55), box(1.3, 0.55, 0.12, red, 0, 1.5, -0.9));
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.45, 16, 1, true, -Math.PI / 2, Math.PI / 2), lac);
    hood.rotation.z = Math.PI / 2; hood.position.set(0, 1.45, -1.0); this.carriage.add(hood);
    this.carriage.add(box(1.2, 0.1, 0.5, lac, 0, 1.5, 0.95));
    for (const sx of [-1, 1]) this.carriage.add(box(0.05, 0.05, 2.2, col("cg_shaft", "#4a3020"), sx * 0.45, 1.0, 2.1));
    for (const [x, z, r] of [[-0.85, 1.0, 0.5], [0.85, 1.0, 0.5], [-0.85, -0.9, 0.62], [0.85, -0.9, 0.62]] as [number, number, number][]) {
      const w = makeWheel(r); w.position.set(x, r, z); this.carriage.add(w); this.wheels.push(w);
    }
    this.carriage.add(cyl(0.04, 0.04, 1.8, gold, 0, 0.5, 1.0, 8).rotateZ(Math.PI / 2), cyl(0.04, 0.04, 1.8, gold, 0, 0.62, -0.9, 8).rotateZ(Math.PI / 2));
    const horse = makeHorse(); horse.g.position.set(0, 0, 3.2); this.horse = horse.g; this.horseLegs = horse.legs; this.carriage.add(horse.g);
    S.add(this.carriage);
  }

  private buildFactory() {
    // Hall x -8..8, z -3..34; tall arched-window bays on the right wall (x = 8) let the low sunset sun stripe the floor.
    const S = this.sets.factory;
    S.add(box(16, 0.1, 40, tex("cg_fac_floor", rep(planksHD(), 4, 10)), 0, -0.05, 15, false));
    const wallMat = col("cg_fac_wall", "#d9c6a4"), wallDk = col("cg_fac_wall_dk", "#b89e78");
    S.add(box(0.3, 6.4, 40, wallMat, -8, 3.2, 15), box(16, 6.4, 0.3, wallMat, 0, 3.2, 34.5));
    for (let i = 0; i < 11; i++) {
      const z = -3 + i * 3.6;
      S.add(box(0.3, 6.4, 1.2, wallMat, 8, 3.2, z));             // pier
      S.add(box(0.3, 1.0, 2.4, wallDk, 8, 0.5, z + 1.8));         // sill wall
      S.add(box(0.3, 1.7, 2.4, wallMat, 8, 5.55, z + 1.8));       // lintel
    }
    S.add(box(16, 0.3, 40, col("cg_fac_ceil", "#8a6a4a"), 0, 6.5, 15, false));
    for (let k = 0; k < 10; k++) S.add(box(16, 0.3, 0.3, col("cg_beam", "#5a3e26"), 0, 6.2, k * 3.6));
    for (const x of [-4.6, 4.6]) for (let k = 0; k < 7; k++) S.add(box(0.5, 6.2, 0.5, col("cg_pillar", "#cfb48c"), x, 3.1, 1 + k * 5));
    // sunlit warm exterior beyond the windows (ground + far wall) so the openings read as sunset outside
    S.add(box(30, 0.05, 60, col("cg_fac_out", "#d9a86a"), 23, -0.1, 15, false));
    S.add(box(0.5, 9, 60, col("cg_fac_far", "#c98f6a"), 30, 4.5, 15, false));
    const banner = sign(7.5, 1.15, factoryBannerTex(), "#7a2b25", 0.04); banner.g.position.set(0, 4.9, 34.3); banner.g.rotation.y = Math.PI; S.add(banner.g);
    // long work tables with leaf heaps and bundles of finished sticks
    const wood = col("cg_table", "#8a5a32");
    for (const tx of [-2.0, 2.0]) {
      S.add(box(1.0, 0.08, 26, wood, tx, 0.76, 13));
      for (let k = 0; k < 9; k++) S.add(box(0.08, 0.72, 0.08, wood, tx + (k % 2 ? 0.4 : -0.4), 0.36, 0.5 + k * 3.1));
      for (const sx of [-1, 1]) S.add(box(0.36, 0.06, 26, col("cg_bench", "#6b4a2e"), tx + sx * 0.78, 0.44, 13));
      for (let k = 0; k < 12; k++) {
        const heap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), col("cg_leafheap", "#7a4a26"));
        heap.position.set(tx + 0.05 * Math.sin(k), 0.8, 1 + k * 2.1); heap.scale.y = 0.55; S.add(heap);
        for (let j = 0; j < 4; j++) { const s = makeStick(); s.position.set(tx + 0.2, 0.815 + j * 0.022, 1.6 + k * 2.1); s.rotation.y = Math.PI / 2; S.add(s); }
      }
    }
    // chalk slate on the pillar behind roller #0 (pops in on "four a minute")
    const sl = sign(0.62, 0.46, slateTex(), "#2b3130", 0.03);
    this.slate = sl.g; this.slate.rotation.y = Math.PI / 2; this.slate.position.set(-4.33, 1.75, 5.0); S.add(this.slate);
  }

  private buildCamp() {
    // Night camp on the Crimean heights: campfire at the origin, lantern pole, tents, field cannon pointing +z, signpost
    const S = this.sets.camp;
    S.add(box(120, 0.1, 120, col("cg_dirt", "#6a5a44"), 0, -0.05, 20, false));
    for (let k = 0; k < 6; k++) { const h = new THREE.Mesh(new THREE.SphereGeometry(18 + k * 4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), col("cg_hill", "#3d4a3a")); h.scale.y = 0.25; h.position.set(-50 + k * 22, -1, 70 + (k % 2) * 12); S.add(h); }
    for (const [x, z, yaw] of [[-4.5, 4, 0.3], [-2.0, 9, -0.2], [5.5, 3, -0.5], [-6.5, 12, 0.1], [1.0, 16, 0.4], [8, 14, 0]] as [number, number, number][]) {
      const t = makeTent(); t.position.set(x, 0, z); t.rotation.y = yaw; S.add(t);
    }
    // campfire: stone ring, logs, flicker flames, warm point light
    for (let k = 0; k < 9; k++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), col("cg_stone", "#7a746a")); s.position.set(Math.cos(k * 0.7) * 0.42, 0.06, Math.sin(k * 0.7) * 0.42); S.add(s); }
    for (let k = 0; k < 3; k++) { const l = cyl(0.05, 0.05, 0.6, col("cg_log", "#4a2e1e"), 0, 0.08, 0, 8); l.rotation.set(Math.PI / 2, k * 1.05, 0); S.add(l); }
    for (let k = 0; k < 4; k++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.13 - k * 0.02, 0.5 - k * 0.06, 8), glow(2.4 - k * 0.2, 1.1 + k * 0.15, 0.25));
      fl.position.set(Math.sin(k * 2.1) * 0.08, 0.3, Math.cos(k * 2.1) * 0.08); fl.layers.set(NOINK); S.add(fl); this.flames.push(fl);
    }
    this.fireLight.position.set(0, 0.6, 0); S.add(this.fireLight);
    S.add(cyl(0.04, 0.05, 3.3, col("cg_pole", "#4a3020"), -1.3, 1.65, 1.75, 8));
    // seating log
    const log = cyl(0.16, 0.16, 1.4, col("cg_log", "#4a2e1e"), -0.95, 0.16, 0.85, 10); log.rotation.set(0, 0.65, Math.PI / 2); S.add(log);
    // field cannon at (3.4, 0, 6.5), barrel along +z
    const cn = new THREE.Group(), iron = col("cg_cannon", "#2d3036"), cw = col("cg_cwood", "#6b4a2e");
    const barrel = cyl(0.13, 0.17, 1.9, iron, 0, 0.95, 0.4, 14); barrel.rotation.x = Math.PI / 2 - 0.12; cn.add(barrel);
    cn.add(box(0.5, 0.3, 1.6, cw, 0, 0.6, -0.4));
    for (const sx of [-1, 1]) { const w = makeWheel(0.55); w.position.set(sx * 0.42, 0.55, 0.1); cn.add(w); }
    cn.add(box(0.14, 0.14, 1.4, cw, 0, 0.25, -1.4));
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), iron); b.position.set(0.6 + (k % 3) * 0.2, 0.1 + (k > 2 ? 0.17 : 0), -0.6 + (k % 2) * 0.1); cn.add(b); }
    cn.position.set(3.4, 0, 6.5); S.add(cn);
    this.muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), glow(3.0, 2.2, 1.0));
    this.muzzle.position.set(3.4, 1.1, 7.6); this.muzzle.layers.set(NOINK); S.add(this.muzzle);
    this.muzzleLight.position.set(3.4, 1.4, 7.4); S.add(this.muzzleLight);
    this.smoke = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: "#a9a49a", transparent: true, opacity: 0.55, depthWrite: false }), 14);
    this.smoke.layers.set(NOINK); this.smoke.frustumCulled = false; S.add(this.smoke);
    // signpost toward home
    const sp = new THREE.Group();
    sp.add(cyl(0.05, 0.06, 2.0, col("cg_pole", "#4a3020"), 0, 1.0, 0, 8));
    const lt = sign(0.9, 0.27, londonTex(), "#d9c9a2", 0.04); lt.g.position.set(0.3, 1.7, 0); lt.g.rotation.y = -0.4; sp.add(lt.g);
    sp.position.set(2.4, 0, 3.6); S.add(sp);
    // moon
    const moon = new THREE.Mesh(new THREE.CircleGeometry(6, 32), glow(1.6, 1.55, 1.3)); moon.position.set(-40, 48, 160); moon.lookAt(0, 0, 0); moon.layers.set(NOINK); S.add(moon);
  }

  private buildOffice() {
    // Office x -4..4, z -3.5..4: desk at the origin (boss sits at z 0.95 facing -z toward the cameras), window + poster
    // + pendulum clock on the back wall (z = 4)
    const S = this.sets.office;
    S.add(box(8, 0.1, 8, tex("cg_off_floor", rep(planksHD(), 2, 2)), 0, -0.05, 0.25, false));
    const paper = col("cg_wallpaper", "#3f5a4a"), wain = col("cg_wain", "#5a3a24");
    S.add(box(8, 3.6, 0.15, paper, 0, 1.8, 4.05), box(0.15, 3.6, 8, paper, -4.05, 1.8, 0.25), box(0.15, 3.6, 8, paper, 4.05, 1.8, 0.25));
    S.add(box(8, 1.0, 0.1, wain, 0, 0.5, 3.96), box(0.1, 1.0, 8, wain, -3.96, 0.5, 0.25), box(0.1, 1.0, 8, wain, 3.96, 0.5, 0.25));
    S.add(box(8, 0.15, 8, col("cg_off_ceil", "#2a221c"), 0, 3.6, 0.25, false));
    const win = sign(2.2, 1.8, nightWindowTex(), "#5a3a24", 0.06); win.g.rotation.y = Math.PI; win.g.position.set(1.4, 2.0, 3.95); S.add(win.g);
    S.add(box(2.4, 0.1, 0.18, wain, 1.4, 1.05, 3.9), box(0.06, 1.8, 0.08, wain, 1.4, 2.0, 3.9));
    // poster (unrolls downward from its top edge on "seventy-five thousand")
    const pg = new THREE.PlaneGeometry(1.2, 1.65); pg.translate(0, -0.825, 0);
    const face = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: posterTex() })); face.rotation.y = Math.PI; face.layers.set(NOINK);
    this.poster.add(face);
    this.posterRoll = cyl(0.045, 0.045, 1.26, col("cg_roll", "#e8dcbb"), 0, 0, 0, 10); this.posterRoll.rotation.z = Math.PI / 2;
    this.poster.position.set(-2.0, 2.6, 3.94); S.add(this.poster); S.add(this.posterRoll);
    // pendulum clock
    const clk = new THREE.Group();
    clk.add(box(0.5, 1.3, 0.18, wain, 0, 0, 0));
    const cf = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ map: clockFaceTex() })); cf.position.set(0, 0.35, -0.095); cf.rotation.y = Math.PI; cf.layers.set(NOINK); clk.add(cf);
    this.pendulum.position.set(0, 0.1, -0.1);
    this.pendulum.add(box(0.02, 0.45, 0.01, col("cg_brass", "#c9a24a"), 0, -0.22, 0));
    const bob = cyl(0.07, 0.07, 0.02, col("cg_brass", "#c9a24a"), 0, -0.46, 0, 16); bob.rotation.x = Math.PI / 2; this.pendulum.add(bob);
    clk.add(this.pendulum); clk.position.set(-3.1, 2.0, 3.88); S.add(clk);
    // desk, chair
    const mah = col("cg_mahogany", "#5a2e1e");
    S.add(box(2.3, 0.08, 1.05, mah, 0, 0.76, 0.2), box(2.2, 0.72, 0.06, mah, 0, 0.36, -0.28));
    for (const sx of [-1, 1]) S.add(box(0.5, 0.72, 0.95, mah, sx * 0.85, 0.36, 0.2));
    S.add(box(1.2, 0.02, 0.6, col("cg_blotter", "#2f5a3e"), 0, 0.81, 0.15, false));
    S.add(box(0.6, 0.08, 0.55, col("cg_chair", "#7a2b25"), 0, 0.46, 1.0), box(0.6, 0.85, 0.08, col("cg_chair", "#7a2b25"), 0, 0.9, 1.3));
    // tower of orders vs a tiny tray of hand-rolled sticks
    const orders = new THREE.Group();
    for (let k = 0; k < 9; k++) orders.add(box(0.32 - (k % 2) * 0.02, 0.06, 0.24, col("cg_ordpaper", k % 3 ? "#efe6cc" : "#e2d4b0"), (k % 3 - 1) * 0.01, 0.03 + k * 0.062, 0));
    const ol = sign(0.22, 0.08, ordersTex(), "#b8262f", 0.01); ol.g.position.set(0, 0.6, -0.125); ol.g.rotation.y = Math.PI; orders.add(ol.g);
    orders.position.set(-0.5, 0.8, 0.32); S.add(orders);
    const tray = new THREE.Group();
    tray.add(box(0.26, 0.02, 0.16, col("cg_brass", "#c9a24a"), 0, 0.01, 0));
    for (let k = 0; k < 3; k++) { const s = makeStick(); s.position.set(0, 0.03, -0.04 + k * 0.04); tray.add(s); }
    tray.position.set(0.32, 0.8, -0.18); S.add(tray);
    // green banker's lamp
    S.add(cyl(0.07, 0.09, 0.03, col("cg_brass", "#c9a24a"), -0.85, 0.815, 0.35, 12), cyl(0.012, 0.012, 0.3, col("cg_brass", "#c9a24a"), -0.85, 0.96, 0.35, 8));
    const shade = cyl(0.06, 0.14, 0.1, glow(0.2, 0.9, 0.45), -0.85, 1.12, 0.32, 14); shade.layers.set(NOINK); S.add(shade);
    // candlestick telephone (bell box on the desk corner)
    const bk = col("cg_bakelite", "#16130f");
    this.phoneBase.add(cyl(0.07, 0.08, 0.03, bk, 0, 0.015, 0, 14), cyl(0.016, 0.02, 0.32, bk, 0, 0.18, 0, 10));
    const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.07, 12, 1, true), bk); mouth.rotation.x = -Math.PI / 2 - 0.3; mouth.position.set(0, 0.35, -0.04); this.phoneBase.add(mouth);
    this.phoneBase.add(box(0.06, 0.012, 0.012, col("cg_hook", "#b9b2a0"), 0.04, 0.3, 0));
    this.phoneBase.add(cyl(0.05, 0.05, 0.02, col("cg_bell", "#c9a24a"), 0.14, 0.03, 0.05, 12));
    this.phoneBase.position.set(0.66, 0.8, -0.05); S.add(this.phoneBase);
    // bookshelf + safe for depth
    S.add(box(1.4, 2.4, 0.4, wain, 3.6, 1.2, 2.0));
    for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) S.add(box(0.12, 0.38, 0.28, col("cg_book" + (k % 4), ["#7a2b25", "#2f5a3e", "#2a3a5a", "#8a6a3a"][k % 4]), 3.45, 0.3 + r * 0.58, 1.5 + k * 0.15));
    S.add(box(0.8, 0.9, 0.7, col("cg_safe", "#2d3036"), -3.3, 0.45, -1.4));
  }

  private buildBarn() {
    // Barn interior x -4..4, z -1..8, open door gap on the left wall (x = -4, z 1.4..4.6). Machine centred at (0, 0, 3),
    // crank flywheel on its +x face, output rod running -z to the catch tray at z ~1.9.
    const S = this.sets.barn;
    const pl = tex("cg_barn_planks", rep(planksHD(), 2, 1)), plDk = col("cg_barn_dk", "#5a3e26");
    S.add(box(8, 0.1, 9, col("cg_barn_floor", "#8a7050"), 0, -0.05, 3.5, false));
    for (let k = 0; k < 30; k++) { const s = box(0.4, 0.01, 0.03, col("cg_straw", "#d9b860"), -3 + hash(k) * 6, 0.006, 0 + hash(k * 3.3) * 7.5, false); s.rotation.y = hash(k * 1.9) * 3; S.add(s); }
    S.add(box(8.2, 3.6, 0.2, pl, 0, 1.8, 8.1), box(8.2, 3.6, 0.2, pl, 0, 1.8, -1.1));
    S.add(box(0.2, 3.6, 9.2, pl, 4.1, 1.8, 3.5));
    S.add(box(0.2, 3.6, 2.6, pl, -4.1, 1.8, -0.15), box(0.2, 3.6, 3.6, pl, -4.1, 1.8, 6.4), box(0.2, 0.9, 3.2, pl, -4.1, 3.15, 3.0));
    // doors swung open outside + warm glow spill on the mud
    for (const [z, a] of [[1.4, 1.2], [4.6, -1.2]] as [number, number][]) { const d = box(0.1, 2.7, 1.6, plDk, 0, 1.35, a > 0 ? -0.8 : 0.8); const h = new THREE.Group(); h.add(d); h.rotation.y = a; h.position.set(-4.15, 0, z); S.add(h); }
    this.doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.28), transparent: true, opacity: 0.32, depthWrite: false }));
    this.doorGlow.rotation.x = -Math.PI / 2; this.doorGlow.position.set(-6.0, 0.02, 3.0); this.doorGlow.layers.set(NOINK); S.add(this.doorGlow);
    // gable roof
    const roofMat = col("cg_barn_roof", "#6b3f2e");
    for (const sx of [-1, 1]) { const r = box(4.8, 0.15, 9.6, roofMat, sx * 2.05, 4.6, 3.5); r.rotation.z = -sx * 0.55; S.add(r); }
    S.add(box(8.2, 0.12, 0.2, plDk, 0, 3.55, 8.0), box(8.2, 0.12, 0.2, plDk, 0, 3.55, -1.0));
    for (let k = 0; k < 4; k++) S.add(box(8.0, 0.18, 0.18, plDk, 0, 3.5, k * 2.6 - 0.5));
    // exterior: muddy wet yard, fence, trees, haystack
    S.add(box(120, 0.05, 120, twoTone(new THREE.MeshPhongMaterial({ color: "#3a3428", specular: "#7c8a90", shininess: 60 })), 0, -0.12, 3.5, false));
    for (let k = 0; k < 7; k++) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.6 + hash(k) * 0.9, 20), twoTone(new THREE.MeshPhongMaterial({ color: "#2a3038", specular: "#c9d6e0", shininess: 120 }))); p.rotation.x = -Math.PI / 2; p.position.set(-6 - hash(k * 2) * 8, -0.08, -4 + hash(k * 5) * 12); S.add(p); }
    for (let k = 0; k < 14; k++) S.add(box(0.1, 1.1, 0.1, plDk, -12 + k * 1.6, 0.55, -6.5));
    S.add(box(22, 0.08, 0.06, plDk, -1.6, 0.85, -6.5), box(22, 0.08, 0.06, plDk, -1.6, 0.45, -6.5));
    for (const [x, z] of [[-14, 6], [7, -8], [-8, 16]] as [number, number][]) {
      const t = new THREE.Group(); t.add(cyl(0.2, 0.3, 3, col("cg_bark", "#4a3424"), 0, 1.5, 0, 8));
      const c = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8), col("cg_wetleaf", "#2f4a32")); c.position.y = 3.8; c.castShadow = true; t.add(c);
      t.position.set(x, 0, z); S.add(t);
    }
    // interior props: hay bales, workbench with tools, bucket under the leak, wall telephone (right wall)
    for (const [x, z, y] of [[-3.2, 7.2, 0.25], [-2.3, 7.3, 0.25], [-2.8, 7.2, 0.75], [3.2, 0.2, 0.25]] as [number, number, number][]) S.add(box(0.9, 0.5, 0.6, col("cg_hay", "#d4b25a"), x, y, z));
    S.add(box(2.4, 0.08, 0.7, col("cg_bench2", "#7a5228"), 1.6, 0.9, 7.55), box(2.4, 0.9, 0.06, plDk, 1.6, 0.45, 7.85));
    for (let k = 0; k < 4; k++) S.add(box(0.05, 0.3, 0.02, col("cg_steel", "#9aa3ad"), 0.8 + k * 0.4, 1.6, 7.98));
    S.add(cyl(0.18, 0.15, 0.3, col("cg_bucket", "#7a7f88"), -1.6, 0.15, 5.2, 14));
    this.drip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: "#bcd6e6" })); this.drip.layers.set(NOINK); S.add(this.drip);
    const wp = new THREE.Group();
    wp.add(box(0.12, 0.5, 0.3, col("cg_phonebox", "#6b4226"), 0, 0, 0), cyl(0.03, 0.03, 0.06, col("cg_bell", "#c9a24a"), -0.08, 0.15, -0.07, 10), cyl(0.03, 0.03, 0.06, col("cg_bell", "#c9a24a"), -0.08, 0.15, 0.07, 10));
    const mp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 10, 1, true), col("cg_bakelite", "#16130f")); mp.rotation.z = Math.PI / 2; mp.position.set(-0.1, -0.02, 0); wp.add(mp);
    wp.position.set(3.94, 1.55, 5.05); S.add(wp);
    // ---- the rolling machine ----
    const M = new THREE.Group(), iron = col("cg_iron2", "#3b3f47"), brass = col("cg_brass", "#c9a24a"), oak = col("cg_oak", "#8a5a32");
    M.add(box(1.8, 0.08, 0.9, iron, 0, 0.9, 0));
    for (const [x, z] of [[-0.82, -0.38], [0.82, -0.38], [-0.82, 0.38], [0.82, 0.38]] as [number, number][]) M.add(box(0.1, 0.9, 0.1, iron, x, 0.45, z));
    M.add(box(1.7, 0.06, 0.06, brass, 0, 0.3, -0.38), box(1.7, 0.06, 0.06, brass, 0, 0.3, 0.38));
    const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.2, 0.5, 4, 1), oak); hop.rotation.y = Math.PI / 4; hop.position.set(-0.4, 1.32, 0.05); hop.castShadow = true; M.add(hop);
    const tob = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 4), col("cg_leafheap", "#7a4a26")); tob.rotation.y = Math.PI / 4; tob.position.set(-0.4, 1.55, 0.05); M.add(tob);
    M.add(box(0.12, 0.3, 0.12, iron, -0.4, 1.0, 0.05));
    // paper bobbin
    this.bobbin.add(cyl(0.24, 0.24, 0.07, col("cg_paperroll", "#f4efe2"), 0, 0, 0, 24), cyl(0.06, 0.06, 0.09, brass, 0, 0, 0, 12));
    this.bobbin.rotation.z = Math.PI / 2; this.bobbin.position.set(0.35, 1.28, 0.32);
    M.add(this.bobbin, box(0.04, 0.35, 0.04, iron, 0.35, 1.06, 0.32));
    // gears on the front face
    for (const [x, r] of [[-0.1, 0.16], [0.18, 0.11]] as [number, number][]) {
      const g = new THREE.Group();
      g.add(cyl(r, r, 0.04, brass, 0, 0, 0, 16));
      for (let k = 0; k < 10; k++) { const tth = box(0.04, 0.04, 0.05, brass, Math.cos(k * 0.628) * (r + 0.015), 0, Math.sin(k * 0.628) * (r + 0.015)); g.add(tth); }
      g.rotation.x = Math.PI / 2; g.position.set(x, 1.1, -0.42); M.add(g); this.gears.push(g);
    }
    // continuous rod tube + cutter, toward -z
    const rod = cyl(0.03, 0.03, 0.75, brass, 0, 0.99, -0.62, 12); rod.rotation.x = Math.PI / 2; M.add(rod);
    this.cutter = box(0.1, 0.12, 0.012, col("cg_steel", "#9aa3ad"), 0, 1.06, -0.98); M.add(this.cutter);
    // flywheel + crank on the +x face
    const fw = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), iron); fw.rotation.y = Math.PI / 2; fw.castShadow = true; this.flywheel.add(fw);
    for (let k = 0; k < 6; k++) { const sp = box(0.03, 0.84, 0.03, iron, 0, 0, 0); sp.rotation.x = (k / 6) * Math.PI; this.flywheel.add(sp); }
    const hub = cyl(0.07, 0.07, 0.1, brass, 0, 0, 0, 12); hub.rotation.z = Math.PI / 2; this.flywheel.add(hub);
    const arm = box(0.04, 0.04, 0.36, brass, 0.06, 0, 0.18); this.flywheel.add(arm);
    const handle = cyl(0.025, 0.025, 0.16, oak, 0.14, 0, 0.36, 10); handle.rotation.z = Math.PI / 2; this.flywheel.add(handle);
    this.flywheel.position.set(0.98, 1.02, 0.1); M.add(this.flywheel);
    M.add(box(0.06, 0.2, 0.06, iron, 0.94, 0.82, 0.1));
    // catch tray on its own stand
    M.add(box(0.62, 0.05, 0.5, oak, 0, 0.86, -1.12), box(0.62, 0.08, 0.03, oak, 0, 0.92, -1.36), box(0.03, 0.08, 0.5, oak, -0.3, 0.92, -1.12), box(0.03, 0.08, 0.5, oak, 0.3, 0.92, -1.12));
    for (const x of [-0.26, 0.26]) M.add(box(0.05, 0.86, 0.05, iron, x, 0.43, -1.12));
    M.position.set(0, 0, 3);
    S.add(M);
  }

  // ======================= helpers =======================
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
  /** fixed world-direction sun (for sets whose light must come through specific openings) */
  private fixedSun(x: number, y: number, z: number) { return this.tmpV2.set(x, y, z).normalize().clone(); }

  private attach(rig: HeroRig25D, side: "L" | "R", obj: THREE.Object3D, yaw: number, pitch = 0, roll = 0) {
    rig.handWorld(side, this.tmpV);
    obj.position.copy(this.tmpV);
    obj.rotation.set(pitch, yaw, roll, "YXZ");
    obj.visible = true;
  }
  private holdBetween(rig: HeroRig25D, obj: THREE.Object3D, yaw: number, fwd = 0.04, dy = 0) {
    rig.handWorld("L", this.tmpV); rig.handWorld("R", this.tmpV2);
    obj.position.copy(this.tmpV).add(this.tmpV2).multiplyScalar(0.5);
    obj.position.x += Math.sin(yaw) * fwd; obj.position.z += Math.cos(yaw) * fwd; obj.position.y += dy;
    obj.rotation.set(0, yaw, 0);
    obj.visible = true;
  }
  /** seated pose: hips on a seat of height `seatY`; feet planted ahead */
  private seated(pos: V3, seatY: number): { pos: V3; footL: V3; footR: V3 } {
    const dy = seatY - 0.72;
    return { pos: [pos[0], dy, pos[2]], footL: [-0.13, -dy + 0.04, 0.38], footR: [0.13, -dy + 0.04, 0.4] };
  }
  /** walking feet + bob */
  private gait(t: number, hz: number, ph: number, stride = 0.15, lift = 0.06) {
    const w = 2 * Math.PI * hz * t + ph, s = Math.sin(w);
    return {
      footL: [-0.12, 0.04 + lift * Math.max(0, s), 0.05 + stride * s] as V3,
      footR: [0.12, 0.04 + lift * Math.max(0, -s), 0.05 - stride * s] as V3,
      bob: 0.022 * Math.abs(Math.cos(w)),
    };
  }

  // ======================= PER-SHOT POSES =======================
  private poseStreet(id: number, f: number, t: number) {
    // ---- carriage (shots 1-2) ----
    const cz = carZ(f);
    this.carriage.visible = id <= 2;
    this.carriage.position.set(CARRIAGE_X, 0, cz);
    for (const [i, w] of this.wheels.entries()) w.rotation.x = (cz / (i < 2 ? 0.5 : 0.62));
    const bounce = 0.02 * Math.abs(Math.sin(f * 0.9));
    this.horse.position.y = bounce * 2;
    this.horseLegs.forEach((l, i) => { l.rotation.x = 0.6 * Math.sin(f * 0.55 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.8 : 0)); });
    if (id <= 2) {
      const look = id === 1 ? 0 : smooth((f - 52) / 14);
      const shake = id === 2 ? 0.18 * Math.sin(f * 0.6) : 0;
      this.rich.pose({ pos: [CARRIAGE_X, 1.27 - 0.72 + bounce, cz - 0.55], yaw: lerp(0, Math.PI - 0.35, look), lean: -0.05,
        expr: id === 1 ? "smug" : f < 60 ? "shock" : "annoyed", frame: f, headPitch: 0.05,
        handL: [-0.26, 0.85, 0.2], handR: id === 2 ? [0.28, 1.55 + shake * 0.3, 0.2] : [0.25, 1.15, 0.28],
        footL: [-0.13, 0.22, 0.4], footR: [0.13, 0.22, 0.42] });
    }
    // ---- the cigar ----
    const crushed = f >= 3;
    this.cigar.visible = id <= 3 && !(id === 3 && f >= 155);
    this.cigar.position.set(...CIGAR_POS);
    this.cigar.rotation.set(0, 0.35, 0);
    this.cigar.scale.set(crushed ? 1.35 : 1, crushed ? 0.32 : 1, crushed ? 1.5 : 1);
    this.crumbs.visible = crushed && id <= 3;
    if (this.crumbs.visible) {
      for (let i = 0; i < 40; i++) {
        const age = Math.min(1, (f - 3) / 8);
        const a = hash(i) * Math.PI * 2, rr = 0.05 + 0.2 * hash(i * 3.7) * age;
        this.dummy.position.set(CIGAR_POS[0] + Math.cos(a) * rr, 0.012 + 0.08 * Math.sin(age * Math.PI) * hash(i * 5.1), CIGAR_POS[2] + Math.sin(a) * rr);
        this.dummy.rotation.set(0, a * 3, 0); this.dummy.scale.setScalar(1); this.dummy.updateMatrix();
        this.crumbs.setMatrixAt(i, this.dummy.matrix);
      }
      this.crumbs.instanceMatrix.needsUpdate = true;
    }
    this.crate.visible = id >= 4;

    // ---- beggar ----
    if (id <= 3) {
      const p = beggarPos(f);
      if (f < 128) {
        const s = this.seated([-3.65, 0, 8.2], 0.12);
        this.beggar.pose({ pos: s.pos, yaw: Math.PI / 2 + 0.5, expr: f < 120 ? "deadpan" : "shock", frame: f, lean: 0.08,
          headYaw: id === 3 ? -0.5 : 0, handL: [-0.22, 0.9, 0.3], handR: [0.22, 0.9, 0.32], footL: s.footL, footR: s.footR });
      } else if (f < 152) {
        const g = this.gait(t, 2.6, 0, 0.22, 0.09);
        this.beggar.pose({ pos: [p[0], g.bob, p[2]], yaw: yawTo([-3.65, 0, 8.2], CIGAR_POS), lean: 0.35, expr: "panicked", frame: f,
          handL: [-0.3, 0.9, 0.3], handR: [0.3, 1.0, 0.45], footL: g.footL, footR: g.footR, motionLines: "speed" });
      } else {
        const up = smooth((f - 160) / 14);
        const yaw = lerp(yawTo(p, CIGAR_POS), yawTo(p, [-1.05, 1.15, 4.95]), up);
        const reachW: V3 = [CIGAR_POS[0], 0.05, CIGAR_POS[2]];
        const reach = toLocal([p[0], -0.3, p[2]], yaw, reachW);
        const crouch = lerp(-0.32, 0, up);
        this.beggar.pose({ pos: [p[0], crouch, p[2]], yaw, lean: lerp(0.55, 0.05, up), expr: f < 162 ? "shock" : "smug", frame: f,
          headPitch: lerp(0.35, -0.05, up),
          handL: [-0.25, 0.7 - crouch, 0.2],
          handR: [lerp(reach[0], 0.12, up), lerp(Math.max(0.2, reach[1] + 0.3), 1.32, up), lerp(Math.min(0.75, reach[2]), 0.32, up)],
          footL: [-0.14, 0.04 - crouch, 0.15], footR: [0.14, 0.04 - crouch, -0.05] });
        if (f >= 155) this.attach(this.beggar, "R", this.cigarHand, yaw + Math.PI / 2, 0, 0.3);
      }
    } else if (id === 4 || id === 6 || id === 7) {
      // seated on his step, shredding at the crate (crate top y 0.42 at x -2.85)
      const s = this.seated(BEGGAR_STEP, 0.36);
      const yaw = Math.PI / 2;
      const w = Math.sin(t * 9), w2 = Math.cos(t * 9);
      let hl: V3 = [-0.12 + 0.04 * w, 0.88 - s.pos[1] - 0.38 + 0.03 * w2, 0.52];
      let hr: V3 = [0.12 - 0.04 * w, 0.88 - s.pos[1] - 0.38 - 0.03 * w2, 0.5];
      let expr: RigPose["expr"] = id === 4 ? "smug" : "deadpan";
      if (id === 7) {
        const u = clamp((f - 404) / 30);
        hl = [-0.08 + 0.05 * u, 0.86 - s.pos[1] - 0.38, 0.6]; hr = [0.08 - 0.05 * u, 0.86 - s.pos[1] - 0.38, 0.6 + 0.02 * Math.sin(t * 14)];
        expr = "smug";
      }
      this.beggar.pose({ pos: s.pos, yaw, lean: 0.25, expr, frame: f, headPitch: 0.3, handL: hl, handR: hr, footL: s.footL, footR: s.footR, blink: id === 7 ? 0 : undefined });
      // shredded flakes drifting down off the crate edge
      this.flakes.visible = id === 6;
      if (id === 6) {
        for (let i = 0; i < 60; i++) {
          const ph = ((t * 0.7 + hash(i)) % 1);
          this.dummy.position.set(-2.95 + 0.25 * hash(i * 2.3) + 0.05 * Math.sin(t * 3 + i), 0.5 - ph * 0.35, BEGGAR_STEP[2] - 0.2 + 0.4 * hash(i * 4.1));
          this.dummy.rotation.set(t * 4 + i, t * 3 + i, 0); this.dummy.scale.setScalar(ph > 0.95 ? 0 : 1); this.dummy.updateMatrix();
          this.flakes.setMatrixAt(i, this.dummy.matrix);
        }
        this.flakes.instanceMatrix.needsUpdate = true;
      }
      if (id === 7) {
        const u = clamp((f - 404) / 30);
        this.scrap.visible = true;
        this.scrap.position.set(-2.88, 0.428, BEGGAR_STEP[2]);
        this.scrap.rotation.set(-Math.PI / 2, 0, 0);
        this.scrap.scale.set(1, Math.max(0.05, 1 - u), 1);
        this.rollTube.visible = true;
        this.rollTube.position.set(-2.88, 0.44, BEGGAR_STEP[2] - 0.055 + 0.055 * u);
        this.rollTube.rotation.set(0, 0, 0);
        this.rollTube.scale.set(1.4, 0.4 + u, 0.4 + u);
      }
    } else if (id === 5) {
      const s = this.seated(BEGGAR_STEP, 0.36);
      this.beggar.pose({ pos: s.pos, yaw: Math.PI / 2 - 0.4, lean: 0.1, expr: "smug", frame: f, handL: [-0.25, 0.7, 0.3], handR: [0.25, 0.7, 0.3], footL: s.footL, footR: s.footR });
    } else if (id === 8) {
      // standing at his crate, selling: coin into his left palm (f446), stick raised high, triumphant
      const bp: V3 = [-3.45, 0.35, 8.95];
      const raise = smooth((f - 462) / 12);
      this.beggar.pose({ pos: bp, yaw: Math.PI / 2 + 0.25, lean: -0.05 * raise, expr: f < 462 ? "smug" : "triumphant", frame: f,
        handL: [-0.22, 1.0, 0.42], handR: [lerp(0.2, 0.28, raise), lerp(1.0, 1.75, raise), lerp(0.42, 0.15, raise)] });
      this.attach(this.beggar, "R", this.handStick, Math.PI / 2, 0, 0.5);
    }

    // ---- poor townsfolk ----
    if (id === 4) {
      // strollers down the street + a woman crossing
      const paths: [V3, number, number][] = [[[1.2, 0, 14], 0, 0.035], [[-0.8, 0, 26], Math.PI, 0.03], [[2.4, 0, 30], Math.PI, 0.028]];
      paths.forEach(([p0, yaw, v], k) => {
        const d = (f - 196) * v, g = this.gait(t, 1.6, k, 0.13, 0.05);
        const p: V3 = [p0[0], g.bob, p0[2] + Math.cos(yaw) * d];
        this.poor[k].pose({ pos: p, yaw, expr: "neutral", frame: f, footL: g.footL, footR: g.footR,
          handL: [-0.24, 0.72 + 0.03 * Math.sin(t * 10 + k), 0.12], handR: [0.24, 0.72 - 0.03 * Math.sin(t * 10 + k), 0.12] });
      });
    } else if (id === 8) {
      const spots: V3[] = [[-2.45, 0, 8.7], [-1.85, 0, 9.55], [-1.5, 0, 8.25], [-1.0, 0, 9.1]];
      spots.forEach((sp, k) => {
        const arrive = k < 2 ? 1 : smooth((f - (466 + (k - 2) * 8)) / 14);
        const p: V3 = [sp[0], 0, lerp(sp[2] - 2.4, sp[2], arrive)];
        const g = arrive < 1 ? this.gait(t, 2, k, 0.15, 0.05) : { footL: [-0.12, 0.04, 0.05] as V3, footR: [0.12, 0.04, 0.05] as V3, bob: 0 };
        const yaw = yawTo(p, [-3.45, 0, 8.95]);
        const coinUp = k === 0 ? (f < 446 ? smooth((f - 440) / 5) : 1 - smooth((f - 448) / 8)) : 0;
        const wave = k > 0 && f > 478 ? Math.abs(Math.sin(t * 8 + k)) : 0;
        this.poor[k].pose({ pos: [p[0], g.bob, p[2]], yaw, expr: k === 0 ? "grin" : f > 478 ? "laugh" : "smile", frame: f, footL: g.footL, footR: g.footR,
          handL: [-0.25, 0.75, 0.15], handR: k === 0 ? [0.18, lerp(0.8, 1.05, coinUp), lerp(0.2, 0.55, coinUp)] : [0.28, 1.2 + 0.4 * wave, 0.2],
          mouthOpen: f > 478 && k > 0 ? 0.3 + 0.3 * Math.abs(Math.sin(t * 10 + k)) : 0 });
      });
      if (f >= 446) { this.attach(this.beggar, "L", this.coin, 0, -Math.PI / 2); this.coin.position.y += 0.02; }
      else {
        this.poor[0].handWorld("R", this.tmpV);
        this.coin.position.copy(this.tmpV); this.coin.rotation.set(0, 0, 0); this.coin.visible = true;
      }
    }
  }

  private poseFactory(id: number, f: number, t: number) {
    // 16 hand-rollers on the benches either side of both tables
    const rows = [2.5, 5.0, 7.5, 10.0];
    let k = 0;
    for (const tx of [-2.0, 2.0]) for (const side of [-1, 1]) for (const z of rows) {
      const rig = this.workers[k];
      const x = tx + side * 0.78, yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const s = this.seated([x, 0, z], 0.47);
      const ph = k * 1.37, w = Math.sin(t * 8 + ph), w2 = Math.cos(t * 8 + ph);
      const hy = 0.84 - s.pos[1];
      const hero = k === 1; // the roller we push into in shot 10 (x -2.78, z 5)
      if (id === 10 && k === 5) { k++; continue; } // clear the sightline across the table
      this.workers[k].pose({ pos: s.pos, yaw, lean: 0.18, frame: f,
        expr: hero ? (f > 654 ? "annoyed" : "deadpan") : (k % 4 === 0 ? "nervous" : k % 4 === 1 ? "deadpan" : k % 4 === 2 ? "neutral" : "annoyed"),
        headPitch: 0.35 + 0.05 * Math.sin(t * 2 + ph), headYaw: hero && f > 660 ? -0.45 * smooth((f - 660) / 8) : 0,
        handL: [-0.1 + 0.05 * w, hy + 0.02 * w2, 0.5], handR: [0.1 + 0.05 * w2, hy + 0.02 * w, 0.52],
        footL: s.footL, footR: s.footR });
      rig.root.visible = true;
      k++;
    }
    const pop = id === 10 ? smooth((f - 654) / 6) : id > 10 ? 1 : 0;
    this.slate.scale.setScalar(Math.max(0.001, pop * (1 + 0.15 * Math.sin(Math.min(1, (f - 654) / 8) * Math.PI))));
  }

  private poseCamp(id: number, f: number, t: number) {
    // fire flicker
    this.flames.forEach((fl, i) => { const s = 0.8 + 0.3 * Math.sin(t * (11 + i * 3) + i) + 0.12 * Math.sin(t * 23 + i * 2); fl.scale.set(1, s, 1); fl.rotation.y = t * (1 + i); });
    this.fireLight.intensity = 9 * (0.85 + 0.15 * Math.sin(t * 17) + 0.08 * Math.sin(t * 29));
    this.campLamp.setActive(true, 22);
    // cannon shot on "war" (f702)
    const age = f - 702;
    const flash = age >= 0 && age < 10 ? Math.pow(1 - age / 10, 1.5) : 0;
    this.muzzle.visible = flash > 0.02;
    this.muzzle.scale.setScalar(0.4 + 2.2 * (1 - flash));
    this.muzzleLight.intensity = 380 * flash;
    this.sparks.update(f, 702, [3.4, 1.2, 7.9], 22);
    this.smoke.visible = age >= 0;
    if (age >= 0) {
      for (let i = 0; i < 14; i++) {
        const a = age / FPS, sp = 0.4 + hash(i) * 1.1;
        this.dummy.position.set(3.4 + (hash(i * 3) - 0.5) * a * 1.4, 1.1 + a * (0.3 + hash(i * 5) * 0.8), 7.9 + a * sp * 2.2);
        this.dummy.scale.setScalar(0.6 + a * (1.4 + hash(i * 7))); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix();
        this.smoke.setMatrixAt(i, this.dummy.matrix);
      }
      this.smoke.instanceMatrix.needsUpdate = true;
    }
    if (id === 11) {
      // gunner beside the cannon flinches + covers his ears
      const cover = smooth((f - 696) / 5);
      this.soldiers[0].pose({ pos: [2.35, 0, 6.2], yaw: -2.5, lean: 0.12 * cover, expr: f < 700 ? "stern" : "shocked_sweat", frame: f,
        handL: [lerp(-0.25, -0.22, cover), lerp(0.75, 1.32, cover), lerp(0.12, 0.02, cover)], handR: [lerp(0.25, 0.22, cover), lerp(0.75, 1.32, cover), lerp(0.12, 0.02, cover)] });
      this.soldiers[1].pose({ pos: [4.6, 0, 5.2], yaw: -2.9, expr: "stern", frame: f, handL: [-0.25, 0.75, 0.12], handR: [0.3, 1.0, 0.3] });
    } else {
      // soldier A on the log rolling a newspaper twist; soldier B slings his kit bag and heads for home
      const pA: V3 = [-0.95, 0, 0.85];
      const sA = this.seated(pA, 0.3);
      const yA = yawTo(pA, [0, 0, 0]) + 0.35;
      const twist = Math.sin(t * 7);
      this.soldiers[0].pose({ pos: sA.pos, yaw: yA, lean: 0.25, expr: f < 790 ? "smile_closed" : "smug", frame: f, headPitch: 0.25,
        handL: [-0.1, 0.95 - sA.pos[1] - 0.25, 0.45 + 0.02 * twist], handR: [0.1, 0.95 - sA.pos[1] - 0.25, 0.45 - 0.02 * twist], footL: sA.footL, footR: sA.footR });
      this.holdBetween(this.soldiers[0], this.news, yA, 0.02, 0.02);
      const go = smooth((f - 808) / 20);
      const pB: V3 = [lerp(0.9, 1.7, go), 0, lerp(1.6, 2.7, go)];
      const g = go > 0 && go < 1 ? this.gait(t, 1.8, 0, 0.15, 0.05) : { footL: [-0.12, 0.04, 0.05] as V3, footR: [0.12, 0.04, 0.05] as V3, bob: 0 };
      const sling = smooth((f - 800) / 10);
      const yB = lerp(yawTo(pB, pA), yawTo(pB, [2.4, 0, 3.6]), go);
      this.soldiers[1].pose({ pos: [pB[0], g.bob, pB[2]], yaw: yB, expr: "grin", frame: f, footL: g.footL, footR: g.footR,
        handL: [-0.25, 0.75, 0.12], handR: [lerp(0.28, 0.2, sling), lerp(0.85, 1.35, sling), lerp(0.15, -0.05, sling)] });
      this.attach(this.soldiers[1], "R", this.kitbag, yB, 0.2);
      this.kitbag.position.y -= 0.15 * (1 - sling);
      // a third soldier warming his hands
      const pC: V3 = [1.05, 0, 0.3];
      this.soldiers[2].pose({ pos: pC, yaw: yawTo(pC, [0, 0, 0]), lean: 0.15, expr: "neutral", frame: f, handL: [-0.12, 0.85, 0.42], handR: [0.12, 0.85, 0.42] });
    }
  }

  private poseOffice(id: number, f: number, t: number) {
    this.officeLamp.setActive(true, 30);
    this.pendulum.rotation.z = 0.32 * Math.sin(t * Math.PI);
    // poster unrolls on "seventy-five thousand" (f1016..1040)
    const un = id < 15 ? 0 : smooth((f - 1014) / 24);
    this.poster.scale.set(1, Math.max(0.02, un), 1);
    this.posterRoll.position.set(-2.0, 2.6 - 1.65 * un, 3.9);
    this.counter.update(f, 1250, 9);
    // telephone bells (rattle) before he answers
    const ring = (f >= 1134 && f < 1154) || (f >= 1160 && f < 1180) ? 0.02 * Math.sin(f * 3.1) : 0;
    this.phoneBase.rotation.set(ring, 0, ring * 1.3);
    const onHook = f < 1185;
    this.earpiece.visible = false;
    if (onHook) { this.earpiece.visible = true; this.earpiece.position.set(0.7, 1.05, -0.05); this.earpiece.rotation.set(0, 0, 0.2); }

    const seat = this.seated([0, 0, 0.98], 0.5);
    const yaw = Math.PI;
    if (id === 13) {
      // slumped, head in hands, desperate
      this.boss.pose({ pos: seat.pos, yaw, lean: 0.18, expr: "shocked_sweat", frame: f, headPitch: -0.05,
        handL: [-0.17, 1.38, 0.3], handR: [0.17, 1.38, 0.3], footL: seat.footL, footR: seat.footR });
    } else if (id === 14) {
      const drum = Math.abs(Math.sin(t * 14));
      this.boss.pose({ pos: seat.pos, yaw, lean: 0.12, expr: f < 965 ? "annoyed" : "deadpan", frame: f, headYaw: f > 965 ? 0.35 : 0,
        handL: [-0.25, 0.84 - seat.pos[1] + 0.03 * drum, 0.45], handR: [0.28, 0.86 - seat.pos[1], 0.48], footL: seat.footL, footR: seat.footR });
    } else if (id === 15) {
      const bp: V3 = [-1.05, 0, 3.0];
      const point = smooth((f - 1030) / 10);
      this.boss.pose({ pos: bp, yaw: Math.PI - 0.35, lean: -0.04, expr: f < 1040 ? "smug" : "triumphant", frame: f,
        handL: [-0.26, 0.78, 0.15], handR: [lerp(0.27, 0.62, point), lerp(0.8, 1.62, point), lerp(0.14, -0.2, point)] });
    } else if (id === 16) {
      const grab = smooth((f - 1176) / 9);
      const pick = smooth((f - 1188) / 10);
      const phoneW: V3 = [0.7, 1.05, -0.05];
      const loc = toLocal(seat.pos, yaw, phoneW);
      this.boss.pose({ pos: seat.pos, yaw, lean: 0.15, expr: f < 1140 ? "deadpan" : "annoyed", frame: f,
        handL: [lerp(-0.25, loc[0], grab), lerp(0.84 - seat.pos[1], loc[1] + 0.25 * pick, grab), lerp(0.4, loc[2] - 0.5 * pick, grab)],
        handR: [0.26, 0.84 - seat.pos[1], 0.45], footL: seat.footL, footR: seat.footR });
      if (!onHook) this.attach(this.boss, "L", this.earpiece, 0, 0.2);
    } else if (id === 17) {
      const laugh = f < 1272;
      const slap = Math.abs(Math.sin(t * 10));
      this.boss.pose({ pos: seat.pos, yaw, lean: laugh ? -0.08 : 0.05, expr: f < 1228 ? "shock" : "laugh", frame: f,
        mouthOpen: laugh ? 0.4 + 0.4 * Math.abs(Math.sin(t * 12)) : 0.1, headPitch: laugh ? -0.15 : 0,
        handL: [-0.22, 1.45, 0.06], handR: [0.28, 0.84 - seat.pos[1] + (f > 1228 ? 0.08 * slap : 0), 0.46], footL: seat.footL, footR: seat.footR });
      this.attach(this.boss, "L", this.earpiece, 0, 0.2);
    }
  }

  private poseBarn(id: number, f: number, t: number) {
    // lantern (dims + flickers on "deadliest"), drips, flywheel / gears / bobbin / cutter, rain + wet reflections
    const flick = f >= 1720 && f < 1745 ? 0.55 + 0.45 * Math.abs(Math.sin(f * 1.7)) : 1;
    const dim = f >= 1795 ? 1 - 0.35 * smooth((f - 1795) / 40) : 1;
    this.barnLamp.setActive(true, 26 * flick * dim);
    const dp = ((f % 26) / 26);
    this.drip.position.set(-1.6, 3.4 - dp * dp * 3.2, 5.2); this.drip.visible = dp < 0.97;
    const a = flyAngle(f), running = f >= 1527;
    this.flywheel.rotation.x = -a;
    this.gears[0].rotation.y = a * 1.6; this.gears[1].rotation.y = -a * 2.3;
    this.bobbin.rotation.x = a * 0.6;
    this.cutter.position.y = 1.06 + (running ? 0.04 * Math.max(0, Math.sin(f * 2.1)) : 0);
    this.rain.update(f, [this.tmpCam.x, 0, this.tmpCam.z], true);
    this.wet.update([{ pos: [-5.2, 0.05, 3.0], color: "#ffb35c", width: 2.4, length: 4.5, opacity: 0.55 }], id === 19, 0.0);
    // output sticks: one every 3 frames from f1530, along the rod then into the tray pile
    const n = running ? Math.min(120, Math.floor((f - 1530) / 3) + 1) : 0;
    this.outSticks.visible = n > 0;
    for (let i = 0; i < 120; i++) {
      if (i >= n || f < 1530) { this.dummy.scale.setScalar(0); this.dummy.position.set(0, -5, 0); this.dummy.updateMatrix(); this.outSticks.setMatrixAt(i, this.dummy.matrix); continue; }
      const born = 1530 + i * 3, age = f - born;
      const layer = Math.floor(i / 14), slot = i % 14;
      const px = -0.08 + (slot % 2) * 0.12 + 0.02 * (hash(i) - 0.5), pz = 1.7 + Math.floor(slot / 2) * 0.05 + 0.01 * (hash(i * 3) - 0.5);
      const py = 0.9 + 0.011 + layer * 0.02;
      if (age < 6) {
        // slides off the rod end and drops
        const u = age / 6;
        this.dummy.position.set(lerp(0, px, u), lerp(1.0, py, u * u), lerp(2.0, pz, u));
        this.dummy.rotation.set(0, (1 - u) * Math.PI / 2 + u * (hash(i) - 0.5) * 0.4, 0);
      } else {
        this.dummy.position.set(px, py, pz);
        this.dummy.rotation.set(0, (hash(i) - 0.5) * 0.3, 0);
      }
      this.dummy.scale.setScalar(1); this.dummy.updateMatrix();
      this.outSticks.setMatrixAt(i, this.dummy.matrix);
    }
    this.outSticks.instanceMatrix.needsUpdate = true;
    // the last stick that rolls toward the lens in the payoff
    this.lastStick.visible = id === 24;
    if (id === 24) {
      const u = smooth((f - 1762) / 30);
      this.lastStick.position.set(lerp(0.0, 0.08, u), 0.925 + 0.06 * (1 - u) * Math.abs(Math.sin(u * 9)), lerp(1.98, 1.7, u));
      this.lastStick.rotation.set(-u * 6, 0.15, 0);
    }

    // ---- James ----
    if (id === 18) {
      const jp: V3 = [3.4, 0, 4.55];
      const yaw = -2.0;
      this.james.pose({ pos: jp, yaw, lean: 0.02, expr: f < 1300 ? "deadpan" : "smug", frame: f, headYaw: 0.2, headPitch: -0.05,
        mouthOpen: f >= 1287 && f < 1340 ? 0.15 + 0.3 * Math.abs(Math.sin(t * 11)) : 0,
        handL: [-0.24, 0.74, 0.12], handR: [0.22, 1.36, 0.02] });
      this.attach(this.james, "R", this.wallEar, yaw, 0.2);
    } else if (id === 19) {
      // silhouette at the machine, seen through the open door
      this.james.pose({ pos: [-0.9, 0, 2.6], yaw: Math.PI / 2, lean: 0.15, expr: "deadpan", frame: f, handL: [-0.12, 0.98, 0.42], handR: [0.14, 1.0 + 0.04 * Math.sin(t * 6), 0.45] });
    } else if (id === 20) {
      const jp: V3 = [1.0, 0, 2.1];
      const yaw = -0.45;
      const twist = Math.sin(t * 6);
      this.james.pose({ pos: jp, yaw, lean: 0.28, expr: f < 1470 ? "deadpan" : "smile_closed", frame: f, headPitch: 0.2, headYaw: f > 1474 ? -0.5 : 0,
        handL: [-0.16, 1.0, 0.45], handR: [0.1 + 0.05 * twist, 1.02, 0.5] });
      this.attach(this.james, "R", this.wrench, yaw, -1.0, 0.4 * twist);
    } else if (id === 21 || id === 22) {
      const jp: V3 = [1.62, 0, 3.05];
      const yaw = -Math.PI / 2 - 0.45;
      // right hand rides the crank handle (world position on the flywheel rim)
      const h = this.crankWorld(a);
      const loc = toLocal(jp, yaw, h);
      const before = f < 1505;
      this.james.pose({ pos: jp, yaw, lean: 0.12, expr: f < 1527 ? "deadpan" : f < 1545 ? "shock" : "grin", frame: f,
        motionLines: f >= 1527 && f < 1540 ? "shock" : undefined, headYaw: -0.25,
        handL: [-0.22, 0.85, 0.35], handR: before ? [0.12, 0.95, 0.35] : loc });
    } else if (id >= 23) {
      const jp: V3 = [1.2, 0, 1.95];
      const yaw = -2.05;
      const turn = smooth((f - 1724) / 10);
      this.james.pose({ pos: jp, yaw, lean: 0.06, frame: f,
        expr: id === 24 ? "deadpan" : f < 1724 ? "triumphant" : "nervous", headPitch: lerp(-0.05, 0.25, turn), headYaw: 0.25 * turn,
        handL: [-0.25, 0.8, 0.2], handR: id === 23 && f < 1724 ? [0.3, 1.5, 0.15] : [0.26, 0.82, 0.18] });
    }
  }

  private crankWorld(a: number): V3 {
    // handle at local (0.14, 0, 0.36) on the flywheel group (x-axis rotation -a), group at machine (0.98,1.02,0.1)+(0,0,3)
    const y = 0.36 * Math.sin(a), z = 0.36 * Math.cos(a);
    return [0.98 + 0.2, 1.02 + y, 3.1 + z];
  }

  private tmpCam = new THREE.Vector3();

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], A = LIGHT_ATMOS[s.light], t = f / FPS;
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.03; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    this.tmpCam.copy(cam.position);
    const focus = new THREE.Vector3(...c.look);

    // sun: camera-relative for the open-air sets; fixed through the window bays in the factory; low moon in the camp
    let sunDir: THREE.Vector3;
    if (s.set === "factory") sunDir = this.fixedSun(1.0, 0.32, 0.25);
    else if (s.set === "office" || (s.set === "barn" && id !== 19)) sunDir = this.fixedSun(-0.6, 0.75, -0.3);
    else sunDir = this.shotSun(id, L);
    const indoor = s.set === "office" || (s.set === "barn" && id !== 19);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground);
    this.hemi.intensity = L.hemiI * (s.set === "office" ? 0.55 : s.set === "barn" ? (id === 19 ? 1.0 : 0.6) : s.set === "camp" ? 0.75 : 1);
    this.sun.color.set(L.sunCol);
    this.sun.intensity = L.sunI * (s.set === "office" ? 0.12 : indoor ? 0.18 : s.set === "camp" ? 0.45 : 1);
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = s.set === "street" ? 22 : s.set === "factory" ? 24 : s.set === "camp" ? 16 : 12;
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias;

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
    this.clouds.group.position.set(cam.position.x, 0, cam.position.z);
    this.clouds.update(f, s.light);
    if (s.set === "office" || s.set === "factory") this.clouds.group.visible = false;
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog;

    // hide every actor / loose prop, then pose what this shot needs
    const cast = [this.beggar, this.rich, this.boss, this.james, ...this.poor, ...this.workers, ...this.soldiers];
    for (const r of cast) r.root.visible = false;
    for (const o of [this.cigarHand, this.handStick, this.coin, this.news, this.kitbag, this.earpiece, this.wallEar, this.wrench,
      this.lastStick, this.flakes, this.scrap, this.rollTube]) o.visible = false;
    this.rain.mesh.visible = false;
    this.campLamp.setActive(false); this.officeLamp.setActive(false); this.barnLamp.setActive(false);
    this.muzzleLight.intensity = 0; this.fireLight.intensity = 0;
    this.sparks.sparks.visible = false; this.sparks.debris.visible = false;
    this.wet.group.visible = false;

    if (s.set === "street") this.poseStreet(id, f, t);
    else if (s.set === "factory") this.poseFactory(id, f, t);
    else if (s.set === "camp") this.poseCamp(id, f, t);
    else if (s.set === "office") this.poseOffice(id, f, t);
    else this.poseBarn(id, f, t);
    if (!A.rain) this.rain.mesh.visible = false;

    // camera-clip guard: never let the lens end up inside an actor (its BackSide ink hull would fill the frame)
    for (const r of cast) {
      if (!r.root.visible) continue;
      const p = r.root.position, dy = cam.position.y - p.y;
      if (dy > -0.2 && dy < 2.0 && Math.hypot(cam.position.x - p.x, cam.position.z - p.z) < 0.4) r.root.visible = false;
    }

    return focus;
  }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
