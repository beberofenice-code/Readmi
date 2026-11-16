// Modular 3D Set Registry for "The Elevator Stranger": elevator car (+ door wall, + lobby / 40th-floor landing seen
// through the doors) and the boss's office. Only the active shot's groups are visible per frame; everything is a pure
// function of the frame number, so shots can be rendered as independent chunks.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D, RigPose } from "../core/rig25d";
import { FPS, SHOTS, BUBBLES, DAN_LINES, BOSS_LINES, POUNDS, STOP_PULL, DRIP_HIT, CUP_SET, V3, camAt, smooth, clamp01 } from "./story";

type G2 = CanvasRenderingContext2D;
const INKC = "#241726";
const UP = new THREE.Vector3(0, 1, 0);

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};
/** Room shell piece: receives but never casts shadows (the key light must reach inside closed rooms) */
const shell = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => box(w, h, d, mat, x, y, z, false);
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
const tex = (key: string, t: THREE.Texture) => lam(key, () => ({ map: t }));
/** Unlit HDR glow material (values > 1 feed the BloomEffect) */
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** overshoot ease for pop-ins */
const backOut = (u: number) => { const x = clamp01(u) - 1; return 1 + 2.70158 * x * x * x + 1.70158 * x * x; };
/** world point -> rig-local limb target for a rig at `pos` turned by `yaw` */
const toLocal = (pos: V3, yaw: number, w: V3): V3 => {
  const dx = w[0] - pos[0], dz = w[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, w[1] - pos[1], dx * s + dz * c];
};
const talk = (f: number, lines: [number, number][]) => lines.some(([a, b]) => f >= a && f < b) ? 0.3 + 0.6 * Math.abs(Math.sin(f * 0.95)) : 0;
const yap = (f: number, rate = 0.8) => 0.2 + 0.7 * Math.abs(Math.sin(f * rate));
const blinkAt = (f: number, seed = 0) => (Math.floor((f + seed) / 3) % 31 === 0 ? 1 : 0);

/** Unlit readable prop: textured face plane (NOINK) + lam backing card (so the card still gets an ink outline) */
const sign = (w: number, h: number, t: THREE.Texture, backHex = "#f4efe3") => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, 0.02, col("sign_back_" + backHex, backHex), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  face.position.z = 0.012;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};
const rr = (g: G2, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

// ---------------- Painted textures ----------------
const wallTex = () => ctex("el_wall", 512, 512, (g, r) => {
  g.fillStyle = "#b9c6d3"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + 0.05 * r()})`; g.fillRect(0, r() * 320, 512, 1 + r() * 2); }
  g.fillStyle = "#95a4b4"; for (let x = 0; x <= 512; x += 128) g.fillRect(x - 3, 0, 6, 320);
  g.fillStyle = "#a36c44"; g.fillRect(0, 320, 512, 192);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = r() > 0.5 ? "#ad7549" : "#99633d"; g.fillRect(x + 2, 334, 60, 178); }
  g.fillStyle = "#6f4830"; g.fillRect(0, 316, 512, 18);
});
const floorTex = () => ctex("el_floor", 256, 256, (g, r) => {
  g.fillStyle = "#3d5562"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "#456070" : "#364c58"; g.fillRect(r() * 256, r() * 256, 5, 5); }
  g.strokeStyle = "#c9a45a"; g.lineWidth = 8; g.strokeRect(18, 18, 220, 220);
});
const posterTex = () => ctex("we_listen_poster", 400, 496, (g) => {
  g.fillStyle = "#fdf6e6"; g.fillRect(0, 0, 400, 496);
  g.fillStyle = "#2f8f83"; g.fillRect(0, 0, 400, 86);
  g.fillStyle = "#ffffff"; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.fillText("MERIDIAN CORP", 200, 58);
  // big friendly ear
  g.strokeStyle = INKC; g.lineWidth = 12; g.fillStyle = "#ffd9b8";
  g.beginPath(); g.ellipse(200, 232, 70, 98, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(206, 222, 36, -1.9, 1.3); g.stroke();
  g.beginPath(); g.arc(196, 262, 16, -0.4, 2.6); g.stroke();
  g.fillStyle = INKC; g.font = "bold 62px sans-serif"; g.fillText("WE LISTEN.", 200, 408);
  g.font = "bold 26px sans-serif"; g.fillStyle = "#6d6470"; g.fillText("(suggestion box: floor 40)", 200, 456);
});
const panelTex = () => ctex("el_panel", 340, 800, (g) => {
  g.fillStyle = "#59616e"; g.fillRect(0, 0, 340, 800);
  g.strokeStyle = "#3b414b"; g.lineWidth = 10; g.strokeRect(5, 5, 330, 790);
  g.fillStyle = "#12161c"; g.fillRect(80, 34, 180, 78);
  g.fillStyle = "#ff9a2e"; g.font = "bold 62px monospace"; g.textAlign = "center"; g.fillText("11", 170, 94);
  g.font = "bold 30px sans-serif";
  for (let i = 0; i < 10; i++) {
    const x = 105 + (i % 2) * 130, y = 180 + Math.floor(i / 2) * 68;
    g.fillStyle = "#d9dde3"; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2b2f38"; g.lineWidth = 5; g.stroke();
    g.fillStyle = "#2b2f38"; g.fillText(String(40 - i * 4), x, y + 11);
  }
  g.fillStyle = "#ffd23c"; g.fillRect(40, 520, 260, 250);
  g.save(); rr(g, 40, 520, 260, 250, 0); g.clip();
  g.strokeStyle = "#1c1c20"; g.lineWidth = 16;
  for (let k = -300; k < 400; k += 44) { g.beginPath(); g.moveTo(40 + k, 770); g.lineTo(40 + k + 250, 520); g.stroke(); }
  g.restore();
  g.fillStyle = "#f6f1e4"; g.fillRect(58, 538, 224, 214);
  g.fillStyle = "#c8262b"; g.font = "bold 30px sans-serif"; g.fillText("EMERGENCY", 170, 572);
  g.font = "bold 44px sans-serif"; g.fillText("STOP", 170, 742);
  g.strokeStyle = "#c8262b"; g.lineWidth = 6; g.beginPath(); g.arc(170, 646, 58, 0, Math.PI * 2); g.stroke();
});
const indicatorTex = (txt: string, arrow: boolean) => ctex(`ind_${txt}_${arrow ? 1 : 0}`, 448, 192, (g) => {
  g.fillStyle = "#0f1217"; g.fillRect(0, 0, 448, 192);
  g.strokeStyle = "#596070"; g.lineWidth = 12; g.strokeRect(6, 6, 436, 180);
  g.fillStyle = "#ff9a2e"; g.font = "bold 138px monospace"; g.textAlign = "center";
  g.fillText(txt, arrow ? 280 : 224, 144);
  if (arrow) { g.beginPath(); g.moveTo(96, 42); g.lineTo(150, 122); g.lineTo(116, 122); g.lineTo(116, 152); g.lineTo(76, 152); g.lineTo(76, 122); g.lineTo(42, 122); g.closePath(); g.fill(); }
});
const bubbleTex = (kind: string) => ctex("bubble_" + kind, 512, 420, (g) => {
  g.lineJoin = "round";
  g.fillStyle = "#ffffff"; g.strokeStyle = INKC; g.lineWidth = 14;
  g.beginPath(); g.moveTo(342, 330); g.lineTo(362, 408); g.lineTo(262, 330); g.closePath(); g.fill(); g.stroke();
  rr(g, 10, 10, 492, 330, 70); g.fill(); g.stroke();
  g.fillRect(252, 300, 100, 32);
  g.textAlign = "center";
  if (kind === "elevator") {
    g.fillStyle = "#aab4c2"; g.fillRect(170, 44, 172, 236); g.lineWidth = 10; g.strokeRect(170, 44, 172, 236);
    g.beginPath(); g.moveTo(256, 44); g.lineTo(256, 280); g.stroke();
    g.save(); g.translate(256, 170); g.rotate(-0.2);
    g.fillStyle = "#ffd23c"; g.fillRect(-190, -36, 380, 72); g.lineWidth = 8; g.strokeRect(-190, -36, 380, 72);
    g.fillStyle = INKC; g.font = "bold 46px sans-serif"; g.fillText("OUT OF ORDER", 0, 17);
    g.restore();
  } else if (kind === "coffee") {
    g.fillStyle = "#f3ede2"; g.beginPath(); g.moveTo(190, 150); g.lineTo(322, 150); g.lineTo(304, 300); g.lineTo(208, 300); g.closePath(); g.fill(); g.lineWidth = 10; g.stroke();
    g.fillStyle = "#b0764a"; g.fillRect(202, 196, 108, 56); g.strokeRect(202, 196, 108, 56);
    // skull on the sleeve
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(256, 218, 19, 0, Math.PI * 2); g.fill(); g.fillRect(244, 228, 24, 16);
    g.fillStyle = INKC; g.beginPath(); g.arc(249, 216, 5, 0, Math.PI * 2); g.arc(263, 216, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#6fa83a"; g.lineWidth = 12; g.lineCap = "round";
    for (const x of [216, 256, 296]) { g.beginPath(); g.moveTo(x, 128); g.bezierCurveTo(x - 26, 100, x + 26, 80, x, 46); g.stroke(); }
    g.strokeStyle = INKC;
  } else if (kind === "boss") {
    g.fillStyle = "#3a3f52"; g.beginPath(); g.moveTo(90, 300); g.quadraticCurveTo(100, 196, 190, 190); g.lineTo(250, 190); g.quadraticCurveTo(330, 196, 340, 300); g.closePath(); g.fill(); g.lineWidth = 10; g.stroke();
    g.fillStyle = "#c8262b"; g.beginPath(); g.moveTo(220, 196); g.lineTo(236, 270); g.lineTo(220, 292); g.lineTo(204, 270); g.closePath(); g.fill();
    g.fillStyle = "#ffe2c2"; g.beginPath(); g.ellipse(220, 122, 66, 70, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#ffd0a8"; g.beginPath(); g.ellipse(292, 126, 20, 30, 0, 0, Math.PI * 2); g.fill(); g.stroke(); // the ear
    g.strokeStyle = "#d1262b"; g.lineWidth = 12; g.beginPath(); g.arc(292, 126, 46, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(260, 94); g.lineTo(324, 158); g.stroke();
    g.fillStyle = INKC; g.font = "bold 34px sans-serif"; g.fillText("since", 418, 150); g.font = "bold 50px sans-serif"; g.fillText("1998", 416, 204);
    g.strokeStyle = INKC;
  } else {
    g.fillStyle = "#d1262b"; g.font = "bold 150px sans-serif"; g.fillText("#@!%", 256, 222);
  }
});
const clockTex = () => ctex("lobby_clock", 512, 512, (g) => {
  g.fillStyle = "#e6dccb"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#fffdf6"; g.strokeStyle = INKC; g.lineWidth = 26;
  g.beginPath(); g.arc(256, 256, 232, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = INKC; g.font = "bold 78px sans-serif"; g.textAlign = "center";
  g.fillText("12", 256, 114); g.fillText("6", 256, 462); g.fillText("3", 446, 284); g.fillText("9", 66, 284);
  g.lineCap = "round"; g.lineWidth = 22; g.beginPath(); g.moveTo(256, 256); g.lineTo(256, 84); g.stroke();   // minute hand: 12
  g.lineWidth = 30; g.beginPath(); g.moveTo(256, 256); g.lineTo(138, 256); g.stroke();                        // hour hand: 9
  g.fillStyle = "#c8262b"; g.beginPath(); g.arc(256, 256, 20, 0, Math.PI * 2); g.fill();
});
const logoTex = () => ctex("lobby_logo", 1024, 220, (g) => {
  g.fillStyle = "#2f8f83"; g.fillRect(0, 0, 1024, 220);
  g.fillStyle = "#ffffff"; g.font = "bold 132px sans-serif"; g.textAlign = "center"; g.fillText("MERIDIAN CORP", 512, 156);
});
const interviewTex = () => ctex("interview_sign", 400, 640, (g) => {
  g.fillStyle = "#fffaf0"; g.fillRect(0, 0, 400, 640);
  g.strokeStyle = "#c8262b"; g.lineWidth = 22; g.strokeRect(11, 11, 378, 618);
  g.fillStyle = INKC; g.textAlign = "center"; g.font = "bold 62px sans-serif";
  g.fillText("INTERVIEWS", 200, 110); g.fillText("TODAY", 200, 182);
  g.fillStyle = "#c8262b"; g.beginPath(); g.moveTo(200, 222); g.lineTo(300, 340); g.lineTo(240, 340); g.lineTo(240, 420); g.lineTo(160, 420); g.lineTo(160, 340); g.lineTo(100, 340); g.closePath(); g.fill();
  g.fillStyle = INKC; g.font = "bold 70px sans-serif"; g.fillText("40th FLOOR", 200, 510);
  g.font = "bold 50px sans-serif"; g.fillStyle = "#c8262b"; g.fillText("9:00 SHARP", 200, 590);
});
const floor40Tex = () => ctex("floor40_sign", 512, 384, (g) => {
  g.fillStyle = "#23262e"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#e8c45a"; g.lineWidth = 14; g.strokeRect(12, 12, 488, 360);
  g.fillStyle = "#e8c45a"; g.textAlign = "center"; g.font = "bold 190px sans-serif"; g.fillText("40", 256, 206);
  g.fillStyle = "#ffffff"; g.font = "bold 50px sans-serif"; g.fillText("EXECUTIVE FLOOR", 256, 290);
  g.font = "bold 34px sans-serif"; g.fillStyle = "#b9bcc4"; g.fillText("interviews  →", 256, 346);
});
const tileTex = () => {
  const t = ctex("lobby_tile", 256, 256, (g) => {
    g.fillStyle = "#e3dccd"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#c2b8a6"; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
    g.strokeStyle = "#a89d8a"; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 128, 128, 128);
  });
  t.repeat.set(8, 9);
  return t;
};
const skylineTex = () => ctex("office_skyline", 1024, 640, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, "#6fb0ee"); sky.addColorStop(0.7, "#cfe6fb"); sky.addColorStop(1, "#f4f1e4");
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#ffffff"; for (const [x, y, s] of [[180, 120, 1], [640, 80, 1.3], [880, 190, 0.8]]) { g.beginPath(); g.ellipse(x, y, 90 * s, 28 * s, 0, 0, Math.PI * 2); g.ellipse(x + 50 * s, y - 20 * s, 60 * s, 30 * s, 0, 0, Math.PI * 2); g.fill(); }
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < 1024) {
      const w = 60 + r() * 90, h = (layer ? 150 : 260) + r() * (layer ? 190 : 150);
      g.fillStyle = layer ? ["#5f7fa8", "#56769f", "#6887b0"][Math.floor(r() * 3)] : "#9bb4d2";
      g.fillRect(x, 640 - h, w, h);
      if (layer) { g.fillStyle = "#cfe2f6"; for (let wy = 640 - h + 14; wy < 630; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) if (r() > 0.3) g.fillRect(wx, wy, 11, 14); }
      x += w + 6 + r() * 24;
    }
  }
});
const nameplateTex = () => ctex("ceo_nameplate", 640, 176, (g) => {
  g.fillStyle = "#e8c45a"; g.fillRect(0, 0, 640, 176);
  g.strokeStyle = "#8a6a1e"; g.lineWidth = 12; g.strokeRect(6, 6, 628, 164);
  g.fillStyle = INKC; g.textAlign = "center"; g.font = "bold 76px serif"; g.fillText("M. VANCE", 320, 84);
  g.font = "bold 52px sans-serif"; g.fillText("C E O", 320, 148);
});
const townhallTex = () => ctex("townhall_poster", 400, 520, (g) => {
  g.fillStyle = "#fdf6e6"; g.fillRect(0, 0, 400, 520);
  g.fillStyle = "#3f6fb5"; g.fillRect(0, 0, 400, 110);
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "bold 50px sans-serif"; g.fillText("ALL-HANDS", 200, 72);
  g.fillStyle = INKC; g.font = "bold 44px sans-serif"; g.fillText("Tell us what", 200, 190); g.fillText("you REALLY", 200, 246); g.fillText("think!", 200, 302);
  g.save(); g.translate(200, 400); g.rotate(-0.22); g.strokeStyle = "#d1262b"; g.lineWidth = 12; g.strokeRect(-168, -52, 336, 104);
  g.fillStyle = "#d1262b"; g.font = "bold 66px sans-serif"; g.fillText("CANCELLED", 0, 24); g.restore();
});
const cupTex = () => ctex("paper_cup", 128, 128, (g) => {
  g.fillStyle = "#f3ede2"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#b0764a"; g.fillRect(0, 34, 128, 60);
});

const PAD_LINES = ["1. Fire consultants", "2. Fix elevators", "3. Ask the janitors"];

export class MultiSetWorld {
  root = new THREE.Group();
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunCache = new Map<number, THREE.Vector3>();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  // groups
  private cabin = new THREE.Group();
  private doorWall = new THREE.Group();
  private landing = new THREE.Group();
  private office = new THREE.Group();

  // elevator props
  private doorL: THREE.Mesh;
  private doorR: THREE.Mesh;
  private ceilGlow: THREE.MeshBasicMaterial;
  private alarmGlow: THREE.MeshBasicMaterial;
  private stopLed: THREE.MeshBasicMaterial;
  private knob: THREE.Group;
  private indIn: THREE.MeshBasicMaterial;
  private indOut: THREE.MeshBasicMaterial;
  private bubble: THREE.Mesh;
  private drip: THREE.Mesh;
  private splash: THREE.Mesh[] = [];
  private lobbyOnly = new THREE.Group();
  private floor40Only = new THREE.Group();
  // shared props
  private cup = new THREE.Group();
  private pad: { g: THREE.Group; face: THREE.Mesh };
  private padCanvas: HTMLCanvasElement;
  private padTex: THREE.CanvasTexture;
  private padKey = "";
  private pencil: THREE.Mesh;
  private povHands: THREE.Mesh[] = [];
  // cast
  private dan: HeroRig25D;
  private boss: HeroRig25D;
  private cands: HeroRig25D[];

  constructor() {
    const R = this.root;
    // 5-stop elevation sky shader (only ever glimpsed outside the rooms)
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

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    R.add(this.cabin, this.doorWall, this.landing, this.office);

    // ---- 1. ELEVATOR CAR: interior x -1.1..1.1, y 0..2.5, z -1 (doors) .. 1 (back wall) ----
    const cab = this.cabin;
    const wallM = tex("el_wall", wallTex());
    const steel = col("el_steel", "#aab4c2"), steelDark = col("el_steel_dark", "#59616e");
    cab.add(shell(2.4, 0.1, 2.2, tex("el_floor", floorTex()), 0, -0.05, 0));
    cab.add(shell(2.4, 2.6, 0.1, wallM, 0, 1.25, 1.05));
    cab.add(shell(0.1, 2.6, 2.2, wallM, 1.15, 1.25, 0), shell(0.1, 2.6, 2.2, wallM, -1.15, 1.25, 0));
    cab.add(shell(2.4, 0.1, 2.2, col("el_ceiling", "#d9dee6"), 0, 2.55, 0));
    this.ceilGlow = glow(1.9, 1.8, 1.55);
    const ceilPanel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 1.1), this.ceilGlow);
    ceilPanel.position.set(0, 2.488, 0); ceilPanel.layers.set(NOINK);
    cab.add(ceilPanel, shell(1.42, 0.05, 1.22, steelDark, 0, 2.49, 0));
    // handrails (back + both sides)
    const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.9, 10);
    const railB = new THREE.Mesh(railGeo, steel); railB.rotation.z = Math.PI / 2; railB.position.set(0, 0.95, 0.91); railB.castShadow = true;
    cab.add(railB);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 10), steel);
      rail.rotation.x = Math.PI / 2; rail.position.set(sx * 1.01, 0.95, 0.42); rail.castShadow = true;
      cab.add(rail, box(0.08, 0.04, 0.04, steelDark, sx * 1.06, 0.95, 0.75), box(0.08, 0.04, 0.04, steelDark, sx * 1.06, 0.95, 0.05));
    }
    for (const bx of [-0.8, 0.8]) cab.add(box(0.04, 0.04, 0.08, steelDark, bx, 0.95, 0.96));
    // "WE LISTEN." poster above where the stranger stands
    const poster = sign(0.5, 0.62, posterTex());
    poster.g.position.set(0.36, 2.0, 0.985); poster.g.rotation.y = Math.PI;
    cab.add(poster.g);
    // red emergency lamp on the back wall
    this.alarmGlow = glow(0.3, 0.03, 0.03);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), this.alarmGlow);
    lamp.position.set(-0.72, 2.3, 0.93); lamp.layers.set(NOINK);
    cab.add(lamp, box(0.24, 0.07, 0.1, steelDark, -0.72, 2.21, 0.96));
    // button panel on the x = +1.1 wall, with the big red emergency-stop mushroom knob
    cab.add(box(0.04, 0.84, 0.38, steelDark, 1.085, 1.22, -0.45));
    const panelFace = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.8), new THREE.MeshBasicMaterial({ map: panelTex() }));
    panelFace.rotation.y = -Math.PI / 2; panelFace.position.set(1.063, 1.22, -0.45); panelFace.layers.set(NOINK);
    cab.add(panelFace);
    this.knob = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.034, 24).rotateZ(Math.PI / 2), col("stop_red", "#d5322f"));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 12).rotateZ(Math.PI / 2), steelDark);
    cap.castShadow = true; stem.position.x = 0.045; stem.scale.x = 1.6;
    this.knob.add(cap, stem);
    cab.add(this.knob);
    this.stopLed = glow(0.25, 0.03, 0.03);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), this.stopLed);
    led.position.set(1.058, 1.092, -0.45); led.layers.set(NOINK);
    cab.add(led);
    // thought bubble (billboard, alpha cut-out) + ceiling drip
    this.bubble = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.558), new THREE.MeshBasicMaterial({ map: bubbleTex("elevator"), alphaTest: 0.5 }));
    this.bubble.layers.set(NOINK);
    R.add(this.bubble);
    const water = new THREE.MeshBasicMaterial({ color: "#8fd0f4" });
    this.drip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), water);
    this.drip.scale.set(1, 1.5, 1); this.drip.layers.set(NOINK);
    cab.add(this.drip);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), water); s.layers.set(NOINK); this.splash.push(s); cab.add(s); }

    // ---- 2. DOOR WALL (hidden for the front-on "fourth wall" cameras) ----
    const dw = this.doorWall;
    const wallOut = col("door_wall", "#c3c8d0");
    dw.add(shell(5.45, 9, 0.1, wallOut, -3.275, 4.5, -1.05), shell(5.45, 9, 0.1, wallOut, 3.275, 4.5, -1.05), shell(1.1, 6.9, 0.1, wallOut, 0, 5.55, -1.05));
    dw.add(box(0.1, 2.2, 0.16, steelDark, -0.6, 1.1, -1.05), box(0.1, 2.2, 0.16, steelDark, 0.6, 1.1, -1.05), box(1.3, 0.1, 0.16, steelDark, 0, 2.15, -1.05));
    const doorM = col("el_door", "#b4bcc9");
    this.doorL = box(0.56, 2.1, 0.04, doorM, 0.28, 1.05, -1.05);
    this.doorR = box(0.56, 2.1, 0.04, doorM, -0.28, 1.05, -1.05);
    dw.add(this.doorL, this.doorR);
    this.indIn = new THREE.MeshBasicMaterial({ map: indicatorTex("10", true) });
    this.indOut = new THREE.MeshBasicMaterial({ map: indicatorTex("40", false) });
    const indA = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.24), this.indIn);
    indA.position.set(0, 2.36, -0.975); indA.layers.set(NOINK);
    const indB = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.24), this.indOut);
    indB.position.set(0, 2.42, -1.125); indB.rotation.y = Math.PI; indB.layers.set(NOINK);
    dw.add(indA, indB, box(0.64, 0.32, 0.03, steelDark, 0, 2.36, -0.995), box(0.64, 0.32, 0.03, steelDark, 0, 2.42, -1.105));

    // ---- 3. LANDING outside the doors: ground-floor lobby (Shot 2) / 40th floor (Shot 14) ----
    const ld = this.landing;
    ld.add(shell(12, 0.1, 13.4, tex("lobby_tile", tileTex()), 0, -0.05, -7.8));
    const marble = col("lobby_wall", "#e6dccb");
    ld.add(shell(12, 9, 0.2, marble, 0, 4.5, -14.4), shell(0.2, 9, 13.4, marble, -6, 4.5, -7.8), shell(0.2, 9, 13.4, marble, 6, 4.5, -7.8));
    for (const [px, pz] of [[-2.4, -5.2], [2.4, -5.2], [-2.4, -10], [2.4, -10]]) ld.add(box(0.5, 9, 0.5, col("lobby_pillar", "#d2c6b2"), px, 4.5, pz));
    for (const [px, pz] of [[-1.45, -2.0], [1.75, -6.4]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 14), col("pot", "#b5593c")); pot.position.set(px, 0.21, pz); pot.castShadow = true;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), col("bush", "#4f9a3f")); leaf.scale.set(1, 1.35, 1); leaf.position.set(px, 0.95, pz); leaf.castShadow = true;
      ld.add(pot, leaf);
    }
    const lo = this.lobbyOnly;
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), new THREE.MeshBasicMaterial({ map: clockTex() }));
    clock.position.set(0, 3.55, -14.28); clock.layers.set(NOINK);
    const logo = sign(3.4, 0.73, logoTex(), "#2f8f83");
    logo.g.position.set(0, 5.1, -14.28);
    const iv = sign(0.5, 0.8, interviewTex(), "#c8262b");
    iv.g.position.set(0.5, 1.0, -3.6); iv.g.rotation.y = -0.2;
    lo.add(clock, logo.g, iv.g, box(0.05, 0.6, 0.05, steelDark, 0.5, 0.3, -3.62));
    lo.add(box(2.6, 1.05, 0.7, col("reception", "#8c5a38"), -3.4, 0.52, -10.5), box(2.7, 0.06, 0.8, col("reception_top", "#e9dfcc"), -3.4, 1.08, -10.5));
    const f40 = sign(0.62, 0.465, floor40Tex(), "#e8c45a");
    f40.g.position.set(-1.28, 1.62, -1.115); f40.g.rotation.y = Math.PI;
    this.floor40Only.add(f40.g);
    ld.add(lo, this.floor40Only);

    // ---- 4. THE BOSS'S OFFICE: desk at the origin, chair + window wall at +z, door wall at z -5.5 ----
    const off = this.office;
    off.add(shell(8, 0.1, 10, col("off_carpet", "#5f7a94"), 0, -0.05, -1));
    off.add(shell(4.6, 0.02, 3.2, col("off_rug", "#c9a45a"), 0, 0.005, 0.2));
    const offWall = col("off_wall", "#ece4d4");
    off.add(shell(8, 4, 0.2, offWall, 0, 2, 3.4), shell(0.2, 4, 10, offWall, 3.7, 2, -1), shell(0.2, 4, 10, offWall, -3.7, 2, -1));
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.75), new THREE.MeshBasicMaterial({ map: skylineTex() }));
    sky.position.set(0, 1.95, 3.29); sky.rotation.y = Math.PI; sky.layers.set(NOINK);
    off.add(sky);
    const frame = col("off_frame", "#f7f3ea");
    off.add(box(4.6, 0.1, 0.1, frame, 0, 3.36, 3.26), box(4.6, 0.1, 0.1, frame, 0, 0.55, 3.26), box(0.1, 2.9, 0.1, frame, -2.25, 1.95, 3.26), box(0.1, 2.9, 0.1, frame, 2.25, 1.95, 3.26),
      box(0.07, 2.8, 0.08, frame, -0.75, 1.95, 3.27), box(0.07, 2.8, 0.08, frame, 0.75, 1.95, 3.27));
    // desk + top + nameplate
    off.add(box(2.3, 0.74, 0.9, col("off_desk", "#8c5a38"), 0, 0.37, 0), box(2.46, 0.06, 1.02, col("off_desk_top", "#a8744a"), 0, 0.77, 0));
    const plate = sign(0.5, 0.1375, nameplateTex(), "#8a6a1e");
    plate.g.position.set(0.3, 0.875, -0.38); plate.g.rotation.set(0.18, Math.PI, 0);
    off.add(plate.g);
    // high-backed leather chair
    const leather = col("off_chair", "#7d4f86");
    const chairTop = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.14, 28, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), leather);
    chairTop.position.set(0, 1.85, 1.3); chairTop.castShadow = true;
    off.add(chairTop);
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 3; bx++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), col("off_chair_btn", "#4a2f52"));
      b.position.set(-0.2 + bx * 0.2 + (by % 2 ? 0.1 : 0) - 0.05, 0.95 + by * 0.28, 1.225);
      off.add(b);
    }
    off.add(box(0.74, 1.3, 0.14, leather, 0, 1.2, 1.3), box(0.72, 0.12, 0.62, leather, 0, 0.44, 1.0), box(0.08, 0.28, 0.5, leather, -0.4, 0.66, 1.02), box(0.08, 0.28, 0.5, leather, 0.4, 0.66, 1.02),
      box(0.1, 0.38, 0.1, col("el_steel_dark", "#59616e"), 0, 0.19, 1.0));
    // door wall with the doorway (x 0.05..1.05) and a dim corridor behind it
    off.add(shell(3.75, 4, 0.2, offWall, -1.825, 2, -5.6), shell(2.65, 4, 0.2, offWall, 2.375, 2, -5.6), shell(1.0, 1.85, 0.2, offWall, 0.55, 3.075, -5.6));
    off.add(box(0.08, 2.2, 0.26, frame, 0.02, 1.1, -5.6), box(0.08, 2.2, 0.26, frame, 1.08, 1.1, -5.6), box(1.14, 0.08, 0.26, frame, 0.55, 2.19, -5.6));
    off.add(shell(4, 4, 0.2, col("corridor", "#8f8a94"), 0.55, 2, -8.2), shell(4, 0.1, 2.8, col("corridor_floor", "#6d6a72"), 0.55, -0.05, -7.0));
    const th = sign(0.56, 0.73, townhallTex());
    th.g.position.set(-1.0, 1.75, -5.49);
    off.add(th.g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.5, 14), col("pot", "#b5593c")); pot.position.set(-2.6, 0.25, 2.6); pot.castShadow = true;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), col("bush", "#4f9a3f")); leaf.scale.set(1, 1.5, 1); leaf.position.set(-2.6, 1.2, 2.6); leaf.castShadow = true;
    off.add(pot, leaf, box(1.3, 1.9, 0.4, col("off_shelf", "#7a5236"), 2.7, 0.95, 2.9));

    // ---- 5. SHARED PROPS: paper coffee cup, notepad + pencil ----
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.032, 0.115, 18), tex("paper_cup", cupTex()));
    cupBody.castShadow = true;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.016, 18), col("cup_lid", "#3a3035")); lid.position.y = 0.064;
    this.cup.add(cupBody, lid);
    R.add(this.cup);
    this.padCanvas = document.createElement("canvas");
    this.padCanvas.width = 512; this.padCanvas.height = 704;
    this.padTex = new THREE.CanvasTexture(this.padCanvas);
    this.padTex.colorSpace = THREE.SRGBColorSpace; this.padTex.anisotropy = 8;
    this.pad = sign(0.2, 0.275, this.padTex, "#8a6a48");
    this.pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), new THREE.MeshBasicMaterial({ color: "#f2b632" }));
    this.pencil.layers.set(NOINK);
    R.add(this.pad.g, this.pencil);
    for (let k = 0; k < 2; k++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), new THREE.MeshBasicMaterial({ color: INKC })); h.layers.set(NOINK); this.povHands.push(h); R.add(h); }

    // ---- 6. CAST ----
    this.dan = new HeroRig25D(R, { jacket: "#3f6fb5", tie: "#c93b3b", hair: "#6a4428" });
    this.boss = new HeroRig25D(R, { jacket: "#2f8f83", hair: "#2b2430", bob: true, glasses: true });
    this.cands = [
      new HeroRig25D(R, { jacket: "#5a9a4a", tie: "#2d3a5c", hair: "#c9862e" }),
      new HeroRig25D(R, { jacket: "#e07a3a", hair: "#3a2a22", bob: true }),
      new HeroRig25D(R, { jacket: "#b4567c", tie: "#f2c84b", hair: "#8c8c8c" }),
    ];
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

  private drawPad(prog: number[]) {
    const key = prog.map((p) => Math.round(p * 40)).join("|");
    if (key === this.padKey) return;
    this.padKey = key;
    const g = this.padCanvas.getContext("2d")!;
    g.fillStyle = "#fffbe8"; g.fillRect(0, 0, 512, 704);
    g.fillStyle = "#d9d2b8"; g.fillRect(0, 0, 512, 56);
    g.fillStyle = "#3a3035"; for (let x = 36; x < 512; x += 62) { g.beginPath(); g.arc(x, 28, 11, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "#b8d4ea"; g.lineWidth = 3;
    for (let y = 200; y < 700; y += 74) { g.beginPath(); g.moveTo(24, y); g.lineTo(488, y); g.stroke(); }
    g.fillStyle = "#c8262b"; g.font = "bold 58px sans-serif"; g.textAlign = "left"; g.fillText("FIX LIST", 34, 132);
    g.fillRect(34, 146, 262, 7);
    g.fillStyle = "#23304f"; g.font = "italic bold 44px sans-serif";
    PAD_LINES.forEach((txt, i) => {
      if (prog[i] <= 0) return;
      const y = 266 + i * 148;
      g.save(); g.beginPath(); g.rect(0, y - 60, 30 + 470 * prog[i], 90); g.clip();
      g.fillText(txt, 30, y);
      g.restore();
    });
    this.padTex.needsUpdate = true;
  }

  /** candidate / Dan rant pose at Dan's mark (rig faces the lens, yaw pi) */
  private rant(rig: HeroRig25D, f: number, o: Partial<RigPose> = {}, amp = 1, pos: V3 = [-0.36, 0, 0.25]) {
    const a = f * 0.42;
    rig.pose({
      pos, yaw: Math.PI, lean: 0.05, headYaw: -0.5 + 0.08 * Math.sin(a * 0.7), expr: "stern", mouthOpen: yap(f),
      handL: [-0.42, 1.22 + 0.16 * amp * Math.sin(a), 0.28 + 0.06 * Math.cos(a)],
      handR: [0.46, 1.18 + 0.16 * amp * Math.sin(a + 2.1), 0.26],
      ...o,
    });
  }

  /** the stranger at her mark; sip 0..1 lifts the cup to her mouth; cup = show the paper cup in her right hand */
  private bossStand(f: number, o: Partial<RigPose> = {}, sip = 0, cup = true, pos: V3 = [0.36, 0, 0.3], yaw = Math.PI) {
    const hold: V3 = [0.2, 0.98, 0.22], mouth: V3 = [0.07, 1.31, 0.27];
    this.boss.pose({ pos, yaw, expr: "neutral", blink: blinkAt(f, 11), handR: lerp3(hold, mouth, sip), ...o });
    if (cup) {
      this.boss.handWorld("R", this.tmpV);
      this.cup.position.copy(this.tmpV).add(this.tmpV2.set(0, 0.035, 0));
      this.cup.rotation.set(0.5 * sip * (yaw === Math.PI ? -1 : 1), 0, 0);
      this.cup.visible = true;
    }
  }

  private showBubble(f: number, id: number, at: V3, cam: THREE.Camera, scale = 1) {
    let cur: (typeof BUBBLES)[number] | null = null;
    for (const b of BUBBLES) if (b[2] === id && f >= b[0]) cur = b;
    if (!cur) return;
    (this.bubble.material as THREE.MeshBasicMaterial).map = bubbleTex(cur[1]);
    const k = backOut((f - cur[0] + 1) / 7);
    this.bubble.position.set(at[0], at[1] + 0.02 * Math.sin(f * 0.21), at[2]);
    this.bubble.quaternion.copy(cam.quaternion);
    this.bubble.scale.setScalar(Math.max(0.01, k) * scale);
    this.bubble.visible = true;
  }

  private setDoors(open: number) {
    this.doorL.position.x = 0.28 + 0.56 * open;
    this.doorR.position.x = -0.28 - 0.56 * open;
  }

  /** run / walk cycle limb targets (rig-local), phase in radians */
  private stride(ph: number, len = 0.3, lift = 0.16, arms = true): Partial<RigPose> {
    const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
    return {
      footL: [-0.11, 0.05 + lift * Math.max(0, Math.cos(ph)), len * sL],
      footR: [0.11, 0.05 + lift * Math.max(0, Math.cos(ph + Math.PI)), len * sR],
      ...(arms ? { handL: [-0.3, 0.98 + 0.1 * sR, 0.3 * sR] as V3, handR: [0.3, 0.98 + 0.1 * sL, 0.3 * sL] as V3 } : {}),
    };
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;

    // 1. Active groups. Front-on cameras stand where the door wall is, so it is hidden for them.
    const inElevator = s.set === "elevator" || s.set === "lobby";
    const doorWallOn = s.set === "lobby" || id === 4 || id === 11 || id === 13 || id === 18;
    this.cabin.visible = inElevator;
    this.doorWall.visible = inElevator && doorWallOn;
    this.landing.visible = s.set === "lobby";
    this.lobbyOnly.visible = id === 2;
    this.floor40Only.visible = id === 14;
    this.office.visible = s.set === "office";

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
    const Rr = 16;
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();

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

    // 3. Elevator electrics: ceiling panel, red emergency lamp (smooth 26-frame pulse), stop LED, floor indicator
    const pulse = 0.5 - 0.5 * Math.cos((f * Math.PI * 2) / 26);
    const alarm = id === 6 || id === 19 || (id === 18 && f >= STOP_PULL + 3);
    const fl = (id === 5 && f >= 462) || (id === 7 && f < 606) ? (hash(Math.floor(f / 2) * 3.7) > 0.5 ? 1 : 0.25) : 1;
    if (id === 6) {
      this.ceilGlow.color.setRGB(0.2, 0.15, 0.16);
      // red wash on top of the night preset
      TONE.uLitCol.value.set(0.62 + 0.5 * pulse, 0.42, 0.5);
      TONE.uShadeLift.value.set(0.05 + 0.13 * pulse, 0.02, 0.05);
      CHAR.uCharTint.value.set(1.0, 0.8 - 0.12 * pulse, 0.84 - 0.12 * pulse);
    } else this.ceilGlow.color.setRGB(1.9 * fl, 1.8 * fl, 1.55 * fl);
    if (alarm) this.alarmGlow.color.setRGB(0.5 + 3.2 * pulse, 0.05 + 0.12 * pulse, 0.05 + 0.08 * pulse);
    else this.alarmGlow.color.setRGB(0.3, 0.03, 0.03);
    const pulled = id === 6 || id === 19 || ((id === 18 || id === 17) && f >= STOP_PULL);
    const pullK = id === 18 ? smooth((f - (STOP_PULL - 2)) / 5) : pulled ? 1 : 0;
    this.knob.position.set(1.04 - 0.06 * pullK, 1.0, -0.45);
    this.stopLed.color.setRGB(pullK > 0.9 ? 3.2 : 0.25, pullK > 0.9 ? 0.2 : 0.03, pullK > 0.9 ? 0.15 : 0.03);
    this.indIn.map = id === 2 ? indicatorTex("1", false) : id === 4 ? indicatorTex(f < 372 ? "10" : "11", true) : indicatorTex("11", false);
    this.indIn.color.setScalar(id === 4 ? 0.82 + 0.18 * Math.sin(f * 0.35) : 1);
    this.indOut.map = indicatorTex(id === 14 ? "40" : "1", false);

    // 4. Reset per-frame actors & props
    for (const r of [this.dan, this.boss, ...this.cands]) r.root.visible = false;
    this.bubble.visible = false; this.cup.visible = false; this.pad.g.visible = false; this.pencil.visible = false;
    this.drip.visible = false; for (const sp of this.splash) sp.visible = false;
    for (const h of this.povHands) h.visible = false;
    this.cup.rotation.set(0, 0, 0);
    this.setDoors(0);

    const DAN: V3 = [-0.36, 0, 0.25];

    if (id === 1) {
      // Hook: mid-rant in the stuck car, bubbles popping, the stranger sips
      this.rant(this.dan, f, f >= 57 ? { handR: [0.34, 1.62 + 0.05 * Math.sin(f * 0.5), 0.2] } : {});
      this.bossStand(f, { headYaw: 0.12 }, smooth((f - 100) / 12) * (1 - smooth((f - 128) / 10)));
      this.showBubble(f, 1, [-0.13, 2.14, 0.3], cam, 0.92);
    } else if (id === 2) {
      // Lobby: Dan sprints at the closing doors and jams an arm in
      const u = clamp01((f - 140) / 100), z = -11.0 + 9.2 * u;
      const reach = smooth((f - 228) / 12);
      const st = this.stride(f * 0.95, 0.34, 0.2);
      this.dan.pose({
        pos: [-0.12, 0.05 * Math.abs(Math.sin(f * 0.95)), z], yaw: 0, lean: 0.2, expr: "shock", mouthOpen: 0.7, ...st,
        handR: lerp3(st.handR as V3, [0.1, 1.28, 0.78], reach),
      });
      this.setDoors(1 - 0.74 * smooth((f - 204) / 38) + 0.2 * smooth((f - 243) / 8));
    } else if (id === 3) {
      // Made it. Dan gets his breath back, the quiet stranger takes one look and goes back to her coffee
      const up = smooth((f - 262) / 30), watch = smooth((f - 296) / 14);
      const pant = 0.03 * Math.sin(f * 0.6) * (1 - up);
      this.dan.pose({
        pos: DAN, yaw: Math.PI, lean: 0.34 * (1 - up) + pant + 0.04, expr: up < 0.6 ? "pained" : "neutral", mouthOpen: up < 0.6 ? 0.5 + 0.4 * Math.sin(f * 0.6) : 0,
        headPitch: 0.3 * watch, headYaw: -0.1 * watch, blink: blinkAt(f, 5),
        handL: lerp3(lerp3([-0.16, 0.66, 0.22], [-0.26, 0.74, 0.12], up), [-0.06, 1.06, 0.3], watch),
        handR: lerp3([0.16, 0.66, 0.22], [0.26, 0.74, 0.12], up),
      });
      const glance = smooth((f - 250) / 12) * (1 - smooth((f - 284) / 14));
      this.bossStand(f, { headYaw: 0.55 * glance }, smooth((f - 312) / 12) * (1 - smooth((f - 326) / 19)));
    } else if (id === 5) {
      // The car shudders and stops: Dan flails for balance, the stranger does not spill a drop
      const env = f < 459 ? 1 : Math.exp(-(f - 459) / 7);
      const sway = 0.05 * Math.sin((f - 428) * 0.9) * env;
      this.dan.pose({ pos: [DAN[0] + sway, 0, DAN[2]], yaw: Math.PI, lean: 0.1 + 1.6 * sway, expr: "shock", mouthOpen: 0.6,
        handL: [-0.62, 1.12 + 2 * sway, 0.12], handR: [0.62, 1.12 - 2 * sway, 0.12], footL: [-0.2, 0.04, 0.05], footR: [0.2, 0.04, 0.05] });
      this.bossStand(f, { pos: [0.36 + 0.5 * sway, 0, 0.3], lean: 0.5 * sway, headYaw: 0.25 * smooth((f - 462) / 10) }, 0, true, [0.36 + 0.5 * sway, 0, 0.3]);
    } else if (id === 6) {
      if (f < 531) {
        this.dan.pose({ pos: DAN, yaw: Math.PI, expr: "shock", mouthOpen: talk(f, DAN_LINES) || 0.3, headYaw: 0.12 * Math.sin(f * 0.5),
          handL: [-0.24, 1.62, 0.06], handR: [0.24, 1.62, 0.06] });
        this.bossStand(f);
      } else {
        // Pounding on the doors (= the lens), then the slump on "Nothing."
        const slump = smooth((f - 574) / 10);
        const hit = (k: number) => POUNDS.filter((_, i) => i % 2 === k).reduce((m, h) => Math.max(m, Math.exp(-Math.abs(f - h) / 2.2)), 0);
        const p: V3 = [-0.22, 0, -0.42];
        this.dan.pose({ pos: p, yaw: Math.PI, lean: 0.12 + 0.24 * slump, expr: slump > 0.5 ? "pained" : "shock", mouthOpen: slump > 0.5 ? 0 : 0.7, headPitch: 0.32 * slump,
          handL: [-0.36, lerp(1.56, 1.34, slump), lerp(0.2 + 0.32 * hit(0), 0.5, slump)],
          handR: [0.36, lerp(1.56, 1.34, slump), lerp(0.2 + 0.32 * hit(1), 0.5, slump)] });
        this.bossStand(f, { headYaw: -0.3 }, smooth((f - 572) / 10) * (1 - smooth((f - 592) / 8)));
      }
    } else if (id === 7) {
      // Lights back. He steps back to his mark and starts talking: "this company is a mess"
      const back = smooth((f - 593) / 20), mess = smooth((f - 648) / 12);
      const p = lerp3([-0.22, 0, -0.42], DAN, back);
      if (f < 636) {
        this.dan.pose({ pos: p, yaw: Math.PI, lean: 0.36 * (1 - back) + 0.04, expr: "stern", headYaw: -0.5 * back, blink: blinkAt(f, 3),
          handL: lerp3([-0.2, 1.3, 0.5], [-0.26, 0.74, 0.12], back), handR: lerp3([0.2, 1.3, 0.5], [0.26, 0.74, 0.12], back), ...this.stride(f * 0.5, 0.1 * (1 - back), 0.05, false) });
      } else this.rant(this.dan, f, { handL: [-0.42 - 0.3 * mess, 1.25 + 0.2 * mess + 0.08 * Math.sin(f * 0.4), 0.25], handR: [0.46 + 0.3 * mess, 1.25 + 0.2 * mess + 0.08 * Math.sin(f * 0.4 + 2), 0.25] });
      this.bossStand(f, { headYaw: 0.22 * smooth((f - 640) / 14) });
    } else if (id === 8) {
      if (f < 790) {
        this.rant(this.dan, f, { handR: [0.36, 1.6 + 0.06 * Math.sin(f * 0.45), 0.22] });
        this.bossStand(f, { headYaw: 0.2 }, 0);
        this.showBubble(f, 8, [-0.13, 2.17, 0.3], cam, 0.92);
      } else if (f < 812) {
        // "...tastes like regret": she studies her cup
        this.rant(this.dan, f);
        const look = smooth((f - 790) / 16);
        this.bossStand(f, { headPitch: 0.3 * look, headYaw: 0.14, expr: "stern", handR: [0.16, 1.1, 0.26], blink: 0 }, 0);
      } else {
        this.rant(this.dan, f, { handR: [0.4, 1.66 + 0.07 * Math.sin(f * 0.5), 0.2], handL: [-0.5, 1.1, 0.3] }, 1.2);
        this.bossStand(f, { headYaw: 0.2 });
        this.showBubble(f, 8, [-0.14, 2.22, 0.3], cam, 0.92);
      }
    } else if (id === 9) {
      // "So what would you fix first?"
      this.rant(this.dan, f, { mouthOpen: 0, expr: "neutral" }, 0.2);
      this.bossStand(f, { headYaw: 0.5 * smooth((f - 903) / 10), mouthOpen: talk(f, BOSS_LINES), blink: f > 956 ? blinkAt(f, 2) : 0 });
    } else if (id === 10) {
      // Nothing left to lose: a shrug, a breath, and he turns to her and lets it all out
      const shrug = smooth((f - 985) / 10) * (1 - smooth((f - 1016) / 10)), go = smooth((f - 1022) / 12);
      if (go < 0.5) {
        this.dan.pose({ pos: DAN, yaw: Math.PI, expr: f < 985 ? "shock" : "neutral", blink: f > 968 && f < 974 ? 1 : 0, headYaw: -0.25,
          handL: lerp3([-0.26, 0.74, 0.12], [-0.52, 1.22, 0.2], shrug), handR: lerp3([0.26, 0.74, 0.12], [0.52, 1.22, 0.2], shrug) });
      } else this.rant(this.dan, f, {}, 1.2);
      this.bossStand(f, { headYaw: 0.3 });
    } else if (id === 11) {
      // Her POV: the fix list writes itself on the notepad
      const pr = [clamp01((f - 1078) / 30), clamp01((f - 1124) / 26), clamp01((f - 1170) / 30)];
      this.drawPad(pr);
      const pg = this.pad.g;
      pg.position.set(0.36, 1.03, -0.1); pg.rotation.set(-1.02, 0, 0.03 * Math.sin(f * 0.08)); pg.visible = true;
      pg.updateMatrixWorld(true);
      let line = 0; for (let i = 0; i < 3; i++) if (pr[i] > 0) line = i;
      const busy = pr[line] > 0 && pr[line] < 1;
      // write head in pad-local coordinates (x right, y up on the page)
      const STARTS = [1078, 1124, 1170];
      const rowY = (i: number) => 0.137 - (266 + i * 148) / 704 * 0.275 + 0.012;
      let lx = -0.094 + 0.184 * (pr[line] > 0 ? pr[line] : 0), ly = rowY(line);
      if (line < 2 && pr[line] >= 1) {
        // carriage return: glide from the end of this line to the start of the next
        const k = smooth((f - (STARTS[line + 1] - 13)) / 13);
        lx = lerp(lx, -0.094, k); ly = lerp(ly, rowY(line + 1), k);
      }
      const tip = pg.localToWorld(this.tmpV.set(lx + (busy ? 0.004 * Math.sin(f * 2.1) : 0), ly + (busy ? 0.006 * Math.sin(f * 2.9) : 0), 0.014));
      const dir = this.tmpV2.set(0.5, -0.45, 0.75).normalize().transformDirection(pg.matrixWorld);
      this.pencil.position.copy(tip).addScaledVector(dir, 0.075);
      this.pencil.quaternion.setFromUnitVectors(UP, dir); this.pencil.visible = true;
      this.povHands[0].position.copy(tip).addScaledVector(dir, 0.13); this.povHands[0].visible = true;
      this.povHands[1].position.copy(pg.localToWorld(this.tmpV2.set(-0.115, -0.09, 0.0))); this.povHands[1].visible = true;
      this.rant(this.dan, f);
    } else if (id === 12) {
      // "...they know where everything leaks": he points at the ceiling, the ceiling answers
      const hitK = f >= DRIP_HIT ? 1 : 0;
      this.rant(this.dan, f, { headPitch: hitK ? 0.1 : -0.28, headYaw: -0.3, expr: hitK ? "pained" : "stern", mouthOpen: hitK ? 0 : yap(f),
        handR: [0.3, 1.78 + 0.03 * Math.sin(f * 0.5), 0.14], handL: [-0.4, 1.0, 0.25] });
      const dy = clamp01((f - 1236) / (DRIP_HIT - 1236));
      if (f >= 1236 && f < DRIP_HIT) { this.drip.position.set(-0.36, 2.46 - 0.78 * dy * dy, 0.3); this.drip.visible = true; }
      if (f >= DRIP_HIT && f < DRIP_HIT + 9) this.splash.forEach((sp, k) => { const a = (f - DRIP_HIT) / 9; sp.position.set(-0.36 + (k - 1) * 0.16 * a, 1.7 + 0.22 * a - 0.5 * a * a, 0.32); sp.visible = true; });
      // she is taking notes now (pad back to the lens)
      this.bossStand(f, { headPitch: 0.22, headYaw: 0.1, handL: [-0.12, 1.04, 0.27], handR: [0.1 + 0.02 * Math.sin(f * 1.7), 1.08 + 0.015 * Math.sin(f * 2.3), 0.3] }, 0, false);
      this.heldPad();
    } else if (id === 13) {
      // Security camera, forty minutes in fast-forward: Dan paces and flails, she barely moves
      const px = -0.58 + 0.24 * Math.sin(f * 0.47), pz = 0.0 + 0.32 * Math.sin(f * 0.58 + 1);
      const yaw = Math.PI + 0.9 * Math.sin(f * 0.39);
      this.dan.pose({ pos: [px, 0, pz], yaw, lean: 0.06, expr: "stern", mouthOpen: yap(f, 1.9), headYaw: -0.3 * Math.sin(f * 0.6),
        handL: [-0.45, 1.25 + 0.3 * Math.sin(f * 1.3), 0.25], handR: [0.45, 1.25 + 0.3 * Math.sin(f * 1.3 + 2.4), 0.25], ...this.stride(f * 1.6, 0.16, 0.08, false) });
      this.bossStand(f, { headYaw: 0.25 + 0.1 * Math.sin(f * 0.3), blink: Math.floor(f / 2) % 9 === 0 ? 1 : 0 }, Math.max(0, Math.sin(f * 0.33)) ** 4);
    } else if (id === 14) {
      // 40th floor: doors open, Dan bolts past the lens; she follows at her own pace
      const open = smooth((f - 1342) / 26);
      this.setDoors(open);
      const go = Math.max(0, f - 1370), z = 0.25 - Math.min(go * go * 0.012, 0.6) - Math.max(0, go - 7) * 0.135;
      const x = lerp(-0.36, -0.12, smooth(go / 10)) - 0.9 * smooth((-1.4 - z) / 4.5);
      if (go <= 0) this.dan.pose({ pos: [DAN[0], 0.03 * Math.abs(Math.sin(f * 0.7)), DAN[2]], yaw: Math.PI, expr: "shock", lean: 0.1, handL: [-0.3, 1.0, 0.2], handR: [0.3, 1.0, 0.2] });
      else this.dan.pose({ pos: [x, 0.05 * Math.abs(Math.sin(f * 0.95)), z], yaw: Math.PI + 0.12, lean: 0.22, expr: "shock", mouthOpen: 0.6, ...this.stride(f * 0.95, 0.34, 0.2) });
      const wk = smooth((f - 1418) / 14), bz = 0.3 - Math.max(0, f - 1418) * 0.03 * wk;
      this.bossStand(f, { headYaw: -0.2 * smooth((f - 1380) / 12), ...(wk > 0 ? this.stride(f * 0.42, 0.14, 0.06, false) : {}) }, smooth((f - 1346) / 12) * (1 - smooth((f - 1372) / 10)), true, [0.36 - 0.2 * wk, 0, bz]);
    } else if (id === 15 && f >= 1475) {
      // Reverse: Dan stares at the empty chair; the stranger strolls in behind him
      const turn = smooth((f - 1503) / 20);
      this.dan.pose({ pos: [-0.3, 0, -2.5], yaw: 0, lean: 0.06 + 0.02 * Math.sin(f * 0.5), expr: "shock", mouthOpen: 0.35 + 0.15 * Math.sin(f * 0.5),
        headYaw: lerp(0.25 * Math.sin((f - 1475) * 0.22), 0.95, turn), handL: [-0.3, 0.9, 0.2], handR: [0.3, 0.9, 0.2] });
      const bz = -5.9 + (f - 1475) * 0.058;
      this.bossStand(f, { ...this.stride(f * 0.42, 0.16, 0.06, false) }, 0, true, [0.6, 0.015 * Math.abs(Math.sin(f * 0.42)), bz], 0);
    } else if (id === 16) {
      this.bossSeat(f, smooth((f - 1538) / 16));
    } else if (id === 17) {
      // Flashback: Dan checks his watch; her free hand drifts toward the button panel
      this.dan.pose({ pos: DAN, yaw: Math.PI, headPitch: 0.3, headYaw: -0.12, expr: "neutral", blink: blinkAt(f, 4), handL: [-0.06, 1.06 + 0.01 * Math.sin(f * 0.4), 0.3],
        footR: [0.12, 0.04 + 0.05 * Math.max(0, Math.sin(f * 0.7)), 0.08] });
      const reach = smooth((f - 1622) / 40);
      const bp: V3 = [0.36, 0, 0.3];
      this.bossStand(f, { headYaw: 0.3 * (1 - reach), handL: lerp3([-0.26, 0.74, 0.12], toLocal(bp, Math.PI, [0.98, 1.0, -0.45]), reach) }, 0);
    } else if (id === 18) {
      // The emergency stop: grab (hover), pull at STOP_PULL, let go
      const grab = smooth((f - 1665) / 16), away = smooth((f - 1716) / 16);
      const bp: V3 = [0.36, 0, 0.3];
      const kx = this.knob.position.x - 0.035;
      const at: V3 = lerp3([kx + 0.01, 0.955 - 0.05 * (1 - grab), -0.395 + 0.12 * (1 - grab)], [0.8, 0.9, -0.15], away);
      this.bossStand(f, { handL: toLocal(bp, Math.PI, at) }, 0, false);
    } else if (id === 19) {
      // Every candidate: jump-cut montage, three more victims on Dan's mark
      const k = f < 1785 ? 0 : f < 1822 ? 1 : 2, rig = this.cands[k];
      if (k === 0) this.rant(rig, f, { expr: "shock", handL: [-0.24, 1.62, 0.06], handR: [0.24, 1.62, 0.06], headYaw: -0.3 + 0.3 * Math.sin(f * 0.5) });
      else if (k === 1) this.rant(rig, f, { expr: "pained", mouthOpen: 0.8, lean: 0.14, handL: [-0.6, 1.5 + 0.2 * Math.sin(f * 0.9), 0.1], handR: [0.6, 1.5 + 0.2 * Math.sin(f * 0.9 + 3), 0.1] });
      else this.rant(rig, f, { handL: [-0.62, 1.34 + 0.05 * Math.sin(f * 0.6), 0.3], handR: [0.4, 1.0, 0.25] }, 1.3);
      this.bossStand(f, { headPitch: 0.2, headYaw: 0.1, handL: [-0.12, 1.04, 0.27], handR: [0.1 + 0.02 * Math.sin(f * 1.7), 1.08 + 0.015 * Math.sin(f * 2.3), 0.3] }, 0, false);
      this.heldPad();
      this.showBubble(f, 19, [-0.13, 2.15, 0.3], cam, 0.92);
    } else if (id === 20) {
      if (f < 1922) this.bossSeat(f, 1);
      else {
        const joy = smooth((f - 1934) / 8);
        this.dan.pose({ pos: [-0.25, 0.04 * joy * Math.abs(Math.sin((f - 1934) * 0.45)), -2.4], yaw: 0, expr: joy > 0.5 ? "grin" : "shock", mouthOpen: joy > 0.5 ? 0 : 0.5, blink: 0,
          handR: lerp3([0.26, 0.74, 0.12], [0.36, 1.74 + 0.05 * Math.sin(f * 0.6), 0.12], joy), handL: lerp3([-0.26, 0.74, 0.12], [-0.36, 1.74 + 0.05 * Math.sin(f * 0.6 + 1.5), 0.12], joy) });
      }
    }
    if (id === 11 || id === 18) this.dan.root.visible = false; // inserts: keep the frame clean

    return focus;
  }

  /** notepad held up in the stranger's left hand, page toward her (the lens sees the card back) + pencil in her right */
  private heldPad() {
    this.drawPad([1, 1, 1]);
    this.boss.handWorld("L", this.tmpV);
    this.pad.g.position.copy(this.tmpV).add(this.tmpV2.set(-0.03, 0.09, 0.02));
    this.pad.g.rotation.set(0.35, 0.15, 0);
    this.pad.g.visible = true;
    this.boss.handWorld("R", this.tmpV);
    this.pencil.position.copy(this.tmpV).add(this.tmpV2.set(0.0, 0.05, 0.0));
    this.pencil.rotation.set(0.2, 0, 0.5);
    this.pencil.visible = true;
  }

  /** The stranger in the boss's chair (sit 0 = standing in front of it, 1 = seated); Shot 16 sit-down and Shot 20 payoff */
  private bossSeat(f: number, sit: number) {
    const turn = smooth((f - 1529) / 12);
    const pos: V3 = [0, -0.2 * sit, 1.0], yaw = Math.PI + 0.7 * (1 - turn);
    const cupRest: V3 = [-0.28, 0.86, 0.22];
    const slide = smooth((f - 1888) / 22);
    const cupNow: V3 = [lerp(cupRest[0], -0.08, slide), cupRest[1], lerp(cupRest[2], -0.3, slide)];
    const setK = smooth((f - (CUP_SET - 14)) / 14), letGo = f >= 1858 ? smooth((f - 1912) / 12) : smooth((f - CUP_SET - 2) / 12);
    const push = f >= 1858 ? smooth((f - 1882) / 8) * (1 - letGo) : 0;
    const restR = toLocal(pos, yaw, [-0.22, 0.83, 0.3]), holdR: V3 = [0.2, 0.98 + 0.2 * sit, 0.22];
    const cupHand = toLocal(pos, yaw, [cupNow[0], 0.8225, cupNow[2]]);
    const handR = f >= 1858 ? lerp3(restR, cupHand, push) : lerp3(lerp3(holdR, cupHand, setK), restR, letGo);
    this.boss.pose({
      pos, yaw, expr: f >= 1912 || (f >= 1580 && f < 1700) ? "smile" : "neutral", blink: blinkAt(f, 7), mouthOpen: talk(f, BOSS_LINES),
      headYaw: f >= 1858 ? -0.12 : 0, lean: 0.04 * sit,
      handR, handL: toLocal(pos, yaw, [0.24, 0.83, 0.28]),
      footL: [-0.1, 0.04 + 0.2 * sit, 0.1 + 0.25 * sit], footR: [0.1, 0.04 + 0.2 * sit, 0.1 + 0.25 * sit],
    });
    if (f < CUP_SET && f < 1858) {
      this.boss.handWorld("R", this.tmpV);
      this.cup.position.copy(this.tmpV).add(this.tmpV2.set(0, 0.035, 0));
    } else this.cup.position.set(cupNow[0], 0.8 + 0.0575, cupNow[2]);
    this.cup.visible = true;
  }
}
