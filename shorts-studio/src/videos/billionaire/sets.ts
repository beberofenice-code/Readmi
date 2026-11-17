// Modular 3D set registry for "What If You Woke Up as a Billionaire?":
//   bedroom (gold bed, butler, night phone), estate (helicopter, gold supercar, yacht + dock, gold gate of cousins),
//   boardroom (yes-men, double sandwich, FUNDED screen, lampshades), street (night hot-dog cart, Sal, the check).
// Only the active shot's set group is visible per frame; twoTone materials everywhere, readable signs are unlit.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D, RigPose, RigStyle } from "../core/rig25d";
import { FPS, SHOTS, TALK, camAt, carX, mouthAt, sitUpK, smooth, walkInK, walkX } from "./story";

type P3 = [number, number, number];

// ---------------- small builders ----------------
const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
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
const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
const phongCache = new Map<string, THREE.MeshPhongMaterial>();
const shiny = (key: string, hex: string, spec = "#fff4c8", sh = 60) => {
  let m = phongCache.get(key);
  if (!m) { m = twoTone(new THREE.MeshPhongMaterial({ color: hex, specular: spec, shininess: sh })); phongCache.set(key, m); }
  return m;
};
const GOLD = () => shiny("gold", "#e0ac38", "#fff0b0", 70);
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const texMat = (key: string, t: THREE.Texture) => lam(key, () => ({ map: t }));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Unlit readable prop: textured face plane + lam backing card (the card keeps the ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#f4efe3") => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, 0.025, col("sign_back_" + backHex, backHex));
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.014;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face, mat };
};

// ---------------- painted textures ----------------
const windowView = (night: boolean) => ctex("bb_view_" + (night ? "n" : "d"), 256, 512, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 512);
  if (night) { sky.addColorStop(0, "#0b1430"); sky.addColorStop(1, "#2a3f74"); } else { sky.addColorStop(0, "#5b9ae6"); sky.addColorStop(1, "#cfe4fb"); }
  g.fillStyle = sky; g.fillRect(0, 0, 256, 512);
  if (night) { g.fillStyle = "#f5f0d8"; g.beginPath(); g.arc(70, 90, 26, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 9; i++) {
    const x = i * 30 - 10, w = 26 + r() * 20, h = 120 + r() * 230;
    g.fillStyle = night ? "#121a33" : "#8aa3c4"; g.fillRect(x, 512 - h, w, h);
    g.fillStyle = night ? "#ffd27a" : "#dbe9f7";
    for (let yy = 512 - h + 10; yy < 500; yy += 18) for (let xx = x + 4; xx < x + w - 6; xx += 9) if (r() < (night ? 0.45 : 0.8)) g.fillRect(xx, yy, 4, 8);
  }
});

const portraitTex = () => ctex("bb_portrait", 256, 320, (g) => {
  g.fillStyle = "#6b2d3c"; g.fillRect(0, 0, 256, 320);
  g.fillStyle = "#ffe2c2"; g.strokeStyle = "#241726"; g.lineWidth = 8;
  g.beginPath(); g.ellipse(128, 170, 70, 64, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#3b2a1e"; g.fillRect(64, 112, 128, 26);
  g.fillStyle = "#241726"; g.fillRect(100, 160, 14, 10); g.fillRect(142, 160, 14, 10);
  g.lineWidth = 7; g.beginPath(); g.arc(128, 190, 22, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = "#f2c23a"; g.beginPath(); // crown
  g.moveTo(78, 112); g.lineTo(84, 58); g.lineTo(106, 86); g.lineTo(128, 48); g.lineTo(150, 86); g.lineTo(172, 58); g.lineTo(178, 112); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#4a2fa0"; g.fillRect(70, 234, 116, 86);
});

const dollarTex = () => ctex("bb_dollar", 256, 256, (g) => {
  g.fillStyle = "#e9b949"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#8a5a12"; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#8a5a12"; g.font = "bold 170px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 128, 136);
});

const facadeTex = () => ctex("bb_mansion", 1024, 512, (g) => {
  g.fillStyle = "#f3ead8"; g.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) {
    const x = 30 + i * 84, y = 70 + row * 220;
    if (row === 1 && (i === 5 || i === 6)) continue;
    g.fillStyle = "#c8b48a"; g.fillRect(x - 6, y - 6, 52, 142);
    g.fillStyle = "#4f6f9e"; g.fillRect(x, y, 40, 130);
    g.fillStyle = "#f3ead8"; g.fillRect(x + 18, y, 4, 130); g.fillRect(x, y + 60, 40, 4);
  }
  g.fillStyle = "#e0ac38"; g.fillRect(0, 0, 1024, 18); g.fillRect(0, 245, 1024, 10);
});

const yachtNameTex = () => ctex("bb_yachtname", 512, 96, (g) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 512, 96);
  g.fillStyle = "#1d2a52"; g.font = "italic bold 52px serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("SIR YACHTS-A-LOT", 256, 50);
});

const screenTex = (mode: "meeting" | "pitch" | "funded" | "lamps") => ctex("bb_screen_" + mode, 640, 320, (g) => {
  g.fillStyle = mode === "funded" ? "#135c34" : "#13254a"; g.fillRect(0, 0, 640, 320);
  g.strokeStyle = "#e8c45a"; g.lineWidth = 10; g.strokeRect(8, 8, 624, 304);
  g.textAlign = "center"; g.fillStyle = "#ffffff";
  if (mode === "meeting") {
    g.font = "bold 58px sans-serif"; g.fillText("BOARD MEETING", 320, 120);
    g.font = "bold 40px sans-serif"; g.fillStyle = "#ffd75e"; g.fillText("AGENDA: LAUGH AT CEO'S JOKES", 320, 200);
    g.fillText("(ALL OF THEM)", 320, 255);
  } else if (mode === "pitch") {
    g.font = "bold 50px sans-serif"; g.fillText("NEW IDEA:", 320, 80);
    g.font = "bold 62px sans-serif"; g.fillStyle = "#ffd75e"; g.fillText("SANDWICH", 320, 160);
    g.font = "bold 36px sans-serif"; g.fillStyle = "#ffffff"; g.fillText("made of 2 smaller sandwiches", 320, 220);
    g.fillText("RISK: none   GENIUS: yes", 320, 278);
  } else if (mode === "funded") {
    g.font = "bold 74px sans-serif"; g.fillStyle = "#ffffff"; g.fillText("FUNDED!", 320, 100);
    g.font = "bold 66px monospace"; g.fillStyle = "#ffd75e"; g.fillText("$1,000,000,000", 320, 190);
    g.font = "bold 38px sans-serif"; g.fillStyle = "#c8f5d2"; g.fillText("DECISION TIME: 11 SEC", 320, 262);
  } else {
    g.font = "bold 52px sans-serif"; g.fillText("NEW DRESS CODE", 320, 110);
    g.font = "bold 64px sans-serif"; g.fillStyle = "#ffd75e"; g.fillText("LAMPSHADES", 320, 200);
    g.font = "bold 34px sans-serif"; g.fillStyle = "#ffffff"; g.fillText("(as worn by our visionary CEO)", 320, 262);
  }
});

const skylineTex = () => ctex("bb_skyline", 1024, 512, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, "#69a7ec"); sky.addColorStop(1, "#d8ebfb");
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 22; i++) {
    const x = i * 48 - 10, w = 40 + r() * 34, h = 160 + r() * 300;
    g.fillStyle = ["#7f98bb", "#90a8c8", "#6f87ab"][i % 3]; g.fillRect(x, 512 - h, w, h);
    g.fillStyle = "#cfe0f2";
    for (let yy = 512 - h + 12; yy < 505; yy += 20) for (let xx = x + 6; xx < x + w - 6; xx += 12) g.fillRect(xx, yy, 6, 10);
  }
});

const nightFacade = (key: string, base: string) => ctex("bb_nf_" + key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let y = 30; y < 470; y += 70) for (let x = 24; x < 490; x += 80) {
    const lit = r() < 0.55;
    g.fillStyle = "#241726"; g.fillRect(x - 4, y - 4, 52, 50);
    g.fillStyle = lit ? (r() < 0.5 ? "#ffcf6e" : "#ffe7a8") : "#2b3550"; g.fillRect(x, y, 44, 42);
  }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 470, 512, 42);
});

const awningTex = () => ctex("bb_awning", 512, 128, (g) => {
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#f6d34a" : "#d8373a"; g.fillRect(i * 32, 0, 32, 128); }
});

const cartSignTex = () => ctex("bb_cartsign", 512, 160, (g) => {
  g.fillStyle = "#f8f1de"; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = "#d8373a"; g.lineWidth = 12; g.strokeRect(8, 8, 496, 144);
  g.fillStyle = "#d8373a"; g.font = "bold 70px sans-serif"; g.textAlign = "center"; g.fillText("SAL'S DOGS", 256, 88);
  g.fillStyle = "#241726"; g.font = "bold 40px sans-serif"; g.fillText("$2  •  NO FANCY STUFF", 256, 136);
});

const checkTex = () => ctex("bb_check", 1024, 450, (g) => {
  g.fillStyle = "#e6f1df"; g.fillRect(0, 0, 1024, 450);
  g.strokeStyle = "#2e6b45"; g.lineWidth = 14; g.strokeRect(10, 10, 1004, 430);
  g.fillStyle = "#2e6b45"; g.font = "bold 40px sans-serif"; g.textAlign = "left"; g.fillText("BILLIONAIRE BANK", 44, 70);
  g.fillStyle = "#241726"; g.font = "bold 30px sans-serif"; g.fillText("PAY TO THE ORDER OF", 44, 150);
  g.strokeStyle = "#241726"; g.lineWidth = 3; g.beginPath(); g.moveTo(400, 158); g.lineTo(980, 158); g.stroke();
  // terrible handwriting: wobbly, slanted, overlapping
  g.save(); g.translate(430, 145); g.rotate(-0.12); g.font = "italic bold 72px cursive"; g.fillStyle = "#1d3fa8"; g.fillText("Sa l", 0, 0); g.restore();
  g.fillStyle = "#ffffff"; g.fillRect(650, 200, 330, 96); g.strokeRect(650, 200, 330, 96);
  g.save(); g.translate(668, 270); g.rotate(0.06); g.font = "italic bold 60px cursive"; g.fillStyle = "#1d3fa8"; g.fillText("$1,OOO,OOO", 0, 0); g.restore();
  g.save(); g.translate(60, 300); g.rotate(-0.05); g.font = "italic bold 50px cursive"; g.fillStyle = "#1d3fa8"; g.fillText("one milyun dollers", 0, 0); g.restore();
  g.strokeStyle = "#1d3fa8"; g.lineWidth = 6; g.beginPath(); g.moveTo(560, 400);
  for (let i = 0; i < 26; i++) g.lineTo(580 + i * 15, 392 + Math.sin(i * 1.9) * 26 - (i % 3) * 6);
  g.stroke();
  g.fillStyle = "#241726"; g.font = "bold 26px sans-serif"; g.fillText("MEMO: honest review", 44, 410);
});

// ---------------- prop builders ----------------
/** Low wedge supercar, modelled facing +z; gold Phong body + red gift bow */
const makeSupercar = () => {
  const root = new THREE.Group();
  const gold = GOLD(), dark = col("bb_dark", "#2a2d36"), glass = col("bb_glass", "#2c3a5c");
  root.add(box(2.0, 0.5, 4.4, gold, 0, 0.5, 0));
  const nose = box(1.96, 0.18, 1.3, gold, 0, 0.68, 1.55); nose.rotation.x = 0.12; root.add(nose);
  const cab = box(1.6, 0.42, 1.9, glass, 0, 0.92, -0.35); root.add(cab);
  root.add(box(1.64, 0.06, 1.5, gold, 0, 1.14, -0.45));
  root.add(box(1.9, 0.07, 0.32, dark, 0, 1.02, -2.05), box(0.08, 0.26, 0.1, dark, -0.7, 0.86, -2.05), box(0.08, 0.26, 0.1, dark, 0.7, 0.86, -2.05));
  const wGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18).rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.98, 1.35], [0.98, 1.35], [-0.98, -1.4], [0.98, -1.4]]) {
    const w = new THREE.Mesh(wGeo, dark); w.position.set(wx, 0.36, wz); w.castShadow = true; root.add(w);
  }
  const hl = glow(2.2, 2.1, 1.7);
  for (const hx of [-0.65, 0.65]) { const h = box(0.36, 0.1, 0.04, hl, hx, 0.62, 2.21); h.layers.set(NOINK); root.add(h); }
  // gift bow + ribbons
  const red = col("bb_ribbon", "#d8262f");
  root.add(box(0.2, 0.03, 4.46, red, 0, 0.765, 0), box(2.06, 0.03, 0.2, red, 0, 0.765, 0.2));
  const bow = new THREE.Group();
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 10, 20), red);
    loop.position.set(0.2 * s, 0.18, 0); loop.rotation.set(0, 0, s * 0.5); loop.scale.set(1, 0.8, 1); loop.castShadow = true;
    bow.add(loop);
  }
  bow.add(ball(0.09, red, 0, 0.12, 0));
  bow.position.set(0, 1.12, -0.45);
  root.add(bow);
  return root;
};

const makeHelicopter = () => {
  const root = new THREE.Group();
  const navy = col("bb_heli", "#27407a"), gold = GOLD(), dark = col("bb_dark", "#2a2d36");
  const body = ball(1.0, navy, 0, 1.45, 0); body.scale.set(1.15, 0.95, 1.6); root.add(body);
  const glassM = col("bb_heliglass", "#9fc4ea");
  const nose = ball(0.75, glassM, 0, 1.55, 0.95); nose.scale.set(1.2, 0.95, 1.0); root.add(nose);
  root.add(box(2.36, 0.12, 0.9, gold, 0, 1.25, -0.2));
  const boom = cyl(0.16, 0.26, 3.6, navy, 0, 1.6, -2.9); boom.rotation.x = Math.PI / 2 - 0.06; root.add(boom);
  root.add(box(0.1, 0.9, 0.6, navy, 0, 2.05, -4.6));
  for (const sx of [-0.85, 0.85]) {
    root.add(box(0.08, 0.06, 3.0, dark, sx, 0.08, 0.1));
    root.add(box(0.06, 0.5, 0.06, dark, sx, 0.33, 0.8), box(0.06, 0.5, 0.06, dark, sx, 0.33, -0.6));
  }
  root.add(cyl(0.09, 0.12, 0.45, dark, 0, 2.55, 0));
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.8, 0);
  rotor.add(box(7.4, 0.04, 0.26, dark), box(0.26, 0.04, 7.4, dark));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.7, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#d9dfe8", transparent: true, opacity: 0.16, depthWrite: false }));
  disc.layers.set(NOINK);
  rotor.add(disc);
  root.add(rotor);
  return { root, rotor };
};

const makeYacht = () => {
  const root = new THREE.Group();
  const white = col("bb_hull", "#f7f6f2"), navy = col("bb_hullnavy", "#22325e"), gold = GOLD(), deck = col("bb_teak", "#b07a4a");
  const L = 12, B = 3.4;
  const sh = new THREE.Shape();
  sh.moveTo(-L / 2, -B / 2); sh.lineTo(L / 2 - 2.6, -B / 2); sh.quadraticCurveTo(L / 2 - 0.4, -B / 2 + 0.2, L / 2 + 0.6, 0);
  sh.quadraticCurveTo(L / 2 - 0.4, B / 2 - 0.2, L / 2 - 2.6, B / 2); sh.lineTo(-L / 2, B / 2); sh.closePath();
  const hullGeo = (h: number) => new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const lower = new THREE.Mesh(hullGeo(0.7), navy); lower.position.y = -0.4; lower.castShadow = true; lower.receiveShadow = true;
  const upper = new THREE.Mesh(hullGeo(1.0), white); upper.position.y = 0.3; upper.castShadow = true; upper.receiveShadow = true;
  const trim = new THREE.Mesh(hullGeo(0.1), gold); trim.position.y = 1.3; trim.scale.set(1.005, 1, 1.01);
  root.add(lower, upper, trim);
  const deckM = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), deck); deckM.position.y = 1.31; deckM.receiveShadow = true;
  root.add(deckM);
  root.add(box(6.0, 1.1, 2.6, white, -1.2, 1.86, 0), box(5.8, 0.36, 2.64, col("bb_ywin", "#1d2a52"), -1.2, 1.95, 0));
  root.add(box(3.6, 0.9, 2.1, white, -1.6, 2.85, 0), box(3.4, 0.28, 2.14, col("bb_ywin", "#1d2a52"), -1.6, 2.9, 0));
  root.add(box(3.9, 0.08, 2.4, gold, -1.6, 3.33, 0));
  root.add(cyl(0.05, 0.06, 2.0, white, -1.0, 4.3, 0));
  const nm = sign(3.2, 0.6, yachtNameTex(), "#ffffff");
  nm.g.position.set(-2.2, 0.82, -B / 2 - 0.02); nm.g.rotation.y = Math.PI;
  root.add(nm.g);
  return root;
};

const makeAlarmClock = () => {
  const g = new THREE.Group();
  const red = col("bb_clock", "#d7343a"), gold = GOLD();
  const body = cyl(0.11, 0.11, 0.07, red, 0, 0.13, 0, 22); body.rotation.x = Math.PI / 2; g.add(body);
  const faceT = ctex("bb_clockface", 128, 128, (c) => {
    c.fillStyle = "#fffaf0"; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#241726"; c.lineWidth = 8; c.lineCap = "round";
    c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 24); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke();
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.095, 24), new THREE.MeshBasicMaterial({ map: faceT }));
  face.position.set(0, 0.13, 0.037); face.layers.set(NOINK); g.add(face);
  for (const s of [-1, 1]) { g.add(ball(0.05, gold, 0.07 * s, 0.25, 0)); g.add(box(0.02, 0.06, 0.02, gold, 0.08 * s, 0.04, 0)); }
  g.add(box(0.02, 0.06, 0.02, gold, 0, 0.27, 0));
  return g;
};

const makeSandwich = (s = 1) => {
  const g = new THREE.Group();
  const bread = col("bb_bread", "#e2b06a"), crust = col("bb_crust", "#b9783a"), lettuce = col("bb_lettuce", "#6cc24a"),
    tomato = col("bb_tomato", "#e0443a"), cheese = col("bb_cheese", "#f5cf3b");
  let y = 0;
  const layer = (w: number, h: number, d: number, m: THREE.Material, x = 0) => { g.add(box(w * s, h * s, d * s, m, x * s, (y + h / 2) * s, 0)); y += h; };
  layer(0.62, 0.07, 0.42, crust);
  layer(0.66, 0.025, 0.46, lettuce);
  // two smaller sandwiches side by side
  const y0 = y;
  for (const x of [-0.16, 0.16]) {
    y = y0;
    layer(0.28, 0.045, 0.3, bread, x); layer(0.3, 0.02, 0.32, cheese, x); layer(0.29, 0.03, 0.31, tomato, x); layer(0.3, 0.02, 0.32, lettuce, x); layer(0.28, 0.045, 0.3, bread, x);
  }
  layer(0.66, 0.025, 0.46, tomato);
  layer(0.62, 0.08, 0.42, crust);
  g.add(cyl(0.008, 0.008, 0.36, col("bb_pick", "#f2e6c8"), 0.0, (y + 0.06) * s, 0, 6));
  return g;
};

const makeLampshade = () => {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.13, 0.27, 0.3, 24, 1, true);
  const shade = new THREE.Mesh(geo, lam("bb_lampshade", () => ({ color: "#f3dfa2", side: THREE.DoubleSide })));
  shade.castShadow = true;
  g.add(shade);
  const fringe = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.29, 0.05, 24, 1, true), lam("bb_fringe", () => ({ color: "#c0532f", side: THREE.DoubleSide })));
  fringe.position.y = -0.16; g.add(fringe);
  g.position.set(0, 0.47, -0.01);
  g.rotation.z = 0.12;
  return g;
};

const makeHood = (hex: string) => {
  const geo = new THREE.SphereGeometry(0.255, 22, 14, Math.PI - 0.55, Math.PI + 1.1, 0, Math.PI * 0.72);
  const m = new THREE.Mesh(geo, lam("bb_hood_" + hex, () => ({ color: hex, side: THREE.DoubleSide })));
  m.scale.set(1.12, 1.04, 1.02);
  m.position.set(0, 0.2, -0.015);
  return m;
};

const makePaperHat = () => {
  const g = new THREE.Group();
  const w = col("bb_paperhat", "#fbfaf6");
  g.add(box(0.36, 0.13, 0.22, w, 0, 0.44, -0.01));
  g.add(box(0.37, 0.035, 0.23, col("bb_hatband", "#d8373a"), 0, 0.39, -0.01));
  return g;
};

export class BillionaireWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private fog = new THREE.Fog("#b8d0ec", 25, 320);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunCache = new Map<number, THREE.Vector3>();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  // characters
  private heroPJ: HeroRig25D;
  private heroRich: HeroRig25D;
  private heroHood: HeroRig25D;
  private butler: HeroRig25D;
  private cousins: HeroRig25D[] = [];
  private execs: { rig: HeroRig25D; pos: P3; yaw: number; lamp: THREE.Group }[] = [];
  private sal: HeroRig25D;
  private heroLamp: THREE.Group;

  // props
  private windowMats: THREE.MeshBasicMaterial[] = [];
  private bedLamp: THREE.MeshBasicMaterial;
  private chandelier: THREE.MeshBasicMaterial;
  private tray: THREE.Group;
  private clock: THREE.Group;
  private phone: THREE.Group;
  private heli: { root: THREE.Group; rotor: THREE.Group };
  private car: THREE.Group;
  private gateLamps: THREE.MeshBasicMaterial;
  private mansionWin: THREE.MeshBasicMaterial;
  private coat: THREE.Mesh;
  private screen: { g: THREE.Group; face: THREE.Mesh; mat: THREE.MeshBasicMaterial };
  private door: THREE.Group;
  private sandwich: THREE.Group;
  private check: { g: THREE.Group; face: THREE.Mesh; mat: THREE.MeshBasicMaterial };
  private checkbook: THREE.Group;
  private pen: THREE.Mesh;
  private streetGlows: THREE.MeshBasicMaterial;

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
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    for (const name of ["bedroom", "estate", "boardroom", "street"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    // ================= 1. BEDROOM =================
    // Back wall at z = 5.0 (camera looks +z), side walls x = +-6. Bed centred on x = 0, headboard against the back wall.
    const bed = this.sets.bedroom;
    bed.add(box(14, 0.1, 14, col("bb_floor", "#a8744a"), 0, -0.05, -1));
    bed.add(box(7.2, 0.02, 7.6, col("bb_rug", "#8e2b3d"), 0, 0.01, 1.6));
    bed.add(box(6.6, 0.025, 7.0, col("bb_rugtrim", "#e0b24a"), 0, 0.012, 1.6));
    bed.add(box(6.2, 0.03, 6.6, col("bb_rug", "#8e2b3d"), 0, 0.015, 1.6));
    const wallM = col("bb_wall", "#2f6e74"), panelM = col("bb_wainscot", "#f1e6cc");
    bed.add(box(12.4, 5.2, 0.2, wallM, 0, 2.6, 5.1));
    bed.add(box(12.4, 1.1, 0.06, panelM, 0, 0.55, 4.99), box(12.4, 0.08, 0.08, GOLD(), 0, 1.12, 4.97));
    for (const sx of [-1, 1]) {
      bed.add(box(0.2, 5.2, 12.4, wallM, 6.1 * sx, 2.6, -1.1));
      bed.add(box(0.06, 1.1, 12.4, panelM, 5.99 * sx, 0.55, -1.1));
    }
    // windows with a painted city view (unlit: day / night swap)
    for (const wx of [-4.4, 4.4]) {
      bed.add(box(1.75, 3.05, 0.08, GOLD(), wx, 2.55, 4.96));
      const wm = new THREE.MeshBasicMaterial({ map: windowView(false) });
      this.windowMats.push(wm);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.85), wm);
      pane.position.set(wx, 2.55, 4.91); pane.rotation.y = Math.PI; pane.layers.set(NOINK);
      bed.add(pane, box(0.05, 2.85, 0.05, GOLD(), wx, 2.55, 4.9), box(1.55, 0.05, 0.05, GOLD(), wx, 2.9, 4.9));
      // velvet curtains
      for (const cx of [-0.98, 0.98]) bed.add(box(0.36, 3.4, 0.16, col("bb_curtain", "#7d1f35"), wx + cx, 2.55, 4.82));
    }
    // giant gold bed
    bed.add(box(4.9, 2.7, 0.24, GOLD(), 0, 1.35, 4.82));                                   // headboard
    bed.add(box(4.5, 0.18, 0.1, col("bb_velvet", "#5b2a86"), 0, 2.3, 4.68));
    const emblem = sign(0.9, 0.9, dollarTex(), "#b7862c");
    emblem.g.position.set(0, 1.85, 4.68); emblem.g.rotation.y = Math.PI;
    bed.add(emblem.g);
    bed.add(box(4.7, 0.36, 4.5, GOLD(), 0, 0.34, 2.55));                                   // frame
    bed.add(box(4.5, 0.26, 4.35, col("bb_mattress", "#fbf7ee"), 0, 0.65, 2.55));          // mattress top 0.78
    for (const px of [-1.25, -0.42, 0.42, 1.25]) {
      const pil = ball(0.45, col("bb_pillow", "#fffdf6"), px, 0.92, 4.15);
      pil.scale.set(0.9, 0.3, 0.55); bed.add(pil);
    }
    bed.add(box(4.62, 0.22, 2.75, col("bb_blanket", "#5b2a86"), 0, 0.89, 1.7));           // blanket z .33..3.07
    bed.add(box(4.64, 0.06, 0.24, GOLD(), 0, 0.98, 2.95));
    for (const [px, pz] of [[-2.35, 0.32], [2.35, 0.32], [-2.35, 4.75], [2.35, 4.75]]) {
      bed.add(cyl(0.09, 0.11, 3.4, GOLD(), px, 1.7, pz));
      bed.add(ball(0.17, GOLD(), px, 3.48, pz));
    }
    // nightstands + lamp
    for (const sx of [-1, 1]) {
      bed.add(box(0.8, 0.7, 0.6, col("bb_nightstand", "#6b3b25"), 3.0 * sx, 0.35, 4.3));
      bed.add(cyl(0.05, 0.12, 0.45, GOLD(), 3.0 * sx, 0.93, 4.3));
    }
    this.bedLamp = glow(1.2, 1.0, 0.7);
    for (const sx of [-1, 1]) {
      const ls = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.3, 18, 1, true), this.bedLamp);
      ls.position.set(3.0 * sx, 1.28, 4.3); ls.layers.set(NOINK); bed.add(ls);
    }
    // portrait of himself (with a crown) above the headboard
    bed.add(box(1.5, 1.8, 0.1, GOLD(), 0, 3.95, 4.95));
    const por = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.55), new THREE.MeshBasicMaterial({ map: portraitTex() }));
    por.position.set(0, 3.95, 4.89); por.rotation.y = Math.PI; por.layers.set(NOINK);
    bed.add(por);
    // chandelier
    this.chandelier = glow(2.4, 1.9, 1.1);
    const chand = new THREE.Group();
    chand.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 32).rotateX(Math.PI / 2), GOLD()));
    chand.add(cyl(0.02, 0.02, 0.9, GOLD(), 0, 0.45, 0, 6));
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.chandelier);
      b.position.set(0.7 * Math.cos((i / 8) * Math.PI * 2), 0.1, 0.7 * Math.sin((i / 8) * Math.PI * 2)); b.layers.set(NOINK);
      chand.add(b);
    }
    chand.position.set(0, 4.3, 1.8);
    bed.add(chand);
    // tray + alarm clock (held by the butler), phone (held by the hero at night)
    this.tray = new THREE.Group();
    const trayDisc = cyl(0.26, 0.24, 0.025, shiny("silver", "#cfd6de", "#ffffff", 80), 0, 0, 0, 28);
    this.tray.add(trayDisc, new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 6, 28).rotateX(Math.PI / 2), shiny("silver", "#cfd6de")));
    this.clock = makeAlarmClock();
    this.clock.position.set(0, 0.012, 0);
    this.tray.add(this.clock);
    R.add(this.tray);
    this.phone = new THREE.Group();
    this.phone.add(box(0.085, 0.16, 0.012, col("bb_phone", "#1b1d24")));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.142), glow(0.9, 1.25, 1.9));
    scr.position.z = -0.007; scr.rotation.y = Math.PI; scr.layers.set(NOINK);
    this.phone.add(scr);
    R.add(this.phone);

    this.heroPJ = new HeroRig25D(bed, { jacket: "#6f8fd6", stripes: "#f2f4fb", hair: "#3b2a1e" });

    // ================= 2. ESTATE =================
    // Mansion front at z = 14 facing -z, gold gate at z = -12, lake for x > 10 with a dock at z = -0.5 and the yacht at z = 3.
    const est = this.sets.estate;
    const grassM = col("bb_grass", "#68b24a");
    est.add(box(120, 0.1, 140, grassM, -50, -0.05, 0));
    est.add(box(5, 0.1, 26, col("bb_drive", "#d9cdb3"), 0, 0.0, 1));
    est.add(box(60, 0.08, 7, col("bb_street", "#4d5160"), 0, -0.01, -16));
    est.add(box(60, 0.12, 2, col("bb_sidewalk", "#b9b4a8"), 0, 0.0, -13.0));
    // lake
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), twoTone(new THREE.MeshPhongMaterial({ color: "#3d8fcf", specular: "#ffffff", shininess: 90 })));
    water.position.set(210, -0.22, 0); water.receiveShadow = true;
    est.add(water);
    est.add(box(0.6, 0.5, 140, col("bb_bank", "#a9946f"), 10.1, -0.05, 0));
    // dock
    est.add(box(12.4, 0.18, 1.5, col("bb_dock", "#a8764a"), 16.0, 0.21, -0.5));
    for (let x = 10.4; x <= 22; x += 1.6) for (const z of [-1.2, 0.2]) est.add(cyl(0.08, 0.08, 1.1, col("bb_post", "#6e4a2e"), x, -0.3, z, 8));
    const yacht = makeYacht();
    yacht.position.set(19.0, 0, 3.0);
    est.add(yacht);
    // mansion
    const fac = facadeTex();
    const facM = texMat("bb_facade", fac);
    const body = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 9), [col("bb_mansion", "#f3ead8"), col("bb_mansion", "#f3ead8"), col("bb_roof", "#3a4d74"), col("bb_mansion", "#f3ead8"), col("bb_mansion", "#f3ead8"), facM]);
    // face order +x,-x,+y,-y,+z,-z: the facade texture goes on the -z face (toward the drive)
    body.position.set(0, 4.5, 18.5); body.castShadow = true; body.receiveShadow = true;
    est.add(body);
    this.mansionWin = glow(0.3, 0.35, 0.45);
    est.add(box(30.4, 0.5, 9.4, GOLD(), 0, 9.1, 18.5));
    const portico = box(12, 0.5, 3.2, col("bb_mansion", "#f3ead8"), 0, 7.6, 12.6); est.add(portico);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 3.2, 3, 1, false, 0, Math.PI * 2), col("bb_mansion", "#f3ead8"));
    ped.rotation.set(Math.PI / 2, 0, Math.PI / 2); ped.scale.set(1, 1, 0.3); ped.position.set(0, 8.85, 12.6); est.add(ped);
    for (let i = 0; i < 6; i++) est.add(cyl(0.32, 0.36, 7.4, col("bb_column", "#fbf7ee"), -5 + i * 2, 3.7, 11.6));
    est.add(box(2.4, 3.6, 0.2, GOLD(), 0, 1.8, 13.95));
    for (let i = 0; i < 4; i++) est.add(box(16 - i * 1.2, 0.18, 1.2, col("bb_steps", "#e9e2d2"), 0, 0.09 + i * 0.18, 11.2 - i * 0.3));
    // hedges, topiary + fountain
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) { const t = ball(0.7, col("bb_topiary", "#3f8f3a"), sx * 3.4, 0.75, 3 + i * 3.2); t.scale.set(1, 1.15, 1); est.add(t); }
    }
    est.add(cyl(2.0, 2.2, 0.6, col("bb_stone", "#d8d2c4"), -9, 0.3, 9), cyl(0.3, 0.4, 1.6, col("bb_stone", "#d8d2c4"), -9, 1.1, 9));
    est.add(new THREE.Mesh(new THREE.CircleGeometry(1.85, 28).rotateX(-Math.PI / 2), col("bb_fountainwater", "#57b3e0")).translateX(-9).translateY(0.55).translateZ(9));
    // helipad + helicopter
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.6, 36).rotateX(-Math.PI / 2), col("bb_helipad", "#454a58"));
    pad.position.set(-4.6, 0.03, 6.0); pad.receiveShadow = true; est.add(pad);
    const hT = ctex("bb_H", 256, 256, (g) => { g.fillStyle = "#f2c23a"; g.font = "bold 220px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("H", 128, 140); });
    const hM = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: hT, transparent: true, alphaTest: 0.5 }));
    hM.position.set(-4.6, 0.04, 6.0); est.add(hM);
    this.heli = makeHelicopter();
    this.heli.root.position.set(-4.6, 0, 6.0); this.heli.root.rotation.y = 0.5;
    est.add(this.heli.root);
    this.car = makeSupercar();
    est.add(this.car);
    // gold gate + pillars + hedge wall at z = -12
    for (let i = 0; i <= 26; i++) est.add(cyl(0.035, 0.035, 2.7, GOLD(), -3.0 + i * (6 / 26), 1.35, -12, 8));
    est.add(box(6.1, 0.1, 0.1, GOLD(), 0, 0.35, -12), box(6.1, 0.1, 0.1, GOLD(), 0, 2.35, -12));
    const crest = sign(0.8, 0.8, dollarTex(), "#b7862c");
    crest.g.position.set(0, 2.9, -12.05); crest.g.rotation.y = Math.PI; est.add(crest.g);
    this.gateLamps = glow(2.6, 2.0, 1.0);
    for (const sx of [-1, 1]) {
      est.add(box(0.7, 3.1, 0.7, col("bb_stone", "#d8d2c4"), 3.4 * sx, 1.55, -12));
      const l = ball(0.2, this.gateLamps, 3.4 * sx, 3.35, -12); l.layers.set(NOINK); est.add(l);
      est.add(box(5.6, 2.2, 0.9, col("bb_hedge", "#3e8a3b"), 6.6 * sx, 1.1, -12));
    }
    // across the street: a few modest houses + a street lamp
    for (let i = 0; i < 6; i++) {
      const hx = -15 + i * 6;
      est.add(box(4.6, 3.4, 4, col("bb_house" + (i % 3), ["#d9a77a", "#9fb6d4", "#e4cf8f"][i % 3]), hx, 1.7, -24));
      const rf = box(5.0, 0.2, 2.6, col("bb_houseroof", "#7a4a3c"), hx, 3.8, -25); rf.rotation.x = 0.5; est.add(rf);
      const w = box(0.9, 0.8, 0.05, this.mansionWin, hx - 1.0, 1.9, -21.97); w.layers.set(NOINK); est.add(w);
    }
    est.add(box(0.12, 4.0, 0.12, col("bb_pole", "#3a3f4a"), 4.8, 2.0, -14.4));
    const sl = ball(0.18, this.gateLamps, 4.8, 4.0, -14.4); sl.layers.set(NOINK); est.add(sl);
    this.coat = box(0.34, 0.5, 0.06, col("bb_coat", "#8a5a3a"));
    est.add(this.coat);

    const cousinStyles: RigStyle[] = [
      { jacket: "#e07b39", hair: "#6b3a1e" },
      { jacket: "#5aa36b", hair: "#2b2b2b", moustache: "#2b2b2b" },
      { jacket: "#c94f86", hair: "#e3c26a" },
      { jacket: "#4f7fd1", hair: "#7a4a2a" },
      { jacket: "#9b6fd1", tie: "#f2c23a", hair: "#3b2a1e" },
    ];
    for (const st of cousinStyles) this.cousins.push(new HeroRig25D(est, st));

    // ================= 3. BOARDROOM =================
    // Table along z (x -0.8..0.8, z -3.5..4.4), CEO at the head (z 5.35), screen + door on the back wall z = 6.9.
    const brd = this.sets.boardroom;
    brd.add(box(12, 0.1, 16, col("bb_carpet", "#4b5c7a"), 0, -0.05, 0));
    brd.add(box(12, 0.2, 16, col("bb_ceiling", "#efe5d2"), 0, 4.1, 0));
    for (let z = -4; z <= 5; z += 3) { const p = box(1.6, 0.04, 0.5, glow(1.6, 1.55, 1.4), 0, 3.99, z); p.layers.set(NOINK); brd.add(p); }
    const panelW = col("bb_panel", "#7a4a2e");
    brd.add(box(0.2, 4.2, 16, panelW, -4.6, 2.1, 0));
    // back wall with a doorway at x -3.9..-2.7
    brd.add(box(8.6, 4.2, 0.2, panelW, 1.6, 2.1, 7.0), box(0.9, 4.2, 0.2, panelW, -4.35, 2.1, 7.0), box(1.2, 1.8, 0.2, panelW, -3.3, 3.3, 7.0));
    brd.add(box(1.4, 0.12, 0.26, GOLD(), -3.3, 2.43, 6.9));
    brd.add(box(3.0, 3.0, 0.1, col("bb_corridor", "#e8dcc4"), -3.3, 1.5, 8.6));
    this.door = new THREE.Group();
    this.door.position.set(-3.9, 0, 6.95);
    const leaf = box(1.18, 2.38, 0.07, col("bb_door", "#5a3220"), 0.59, 1.19, 0);
    leaf.add(ball(0.05, GOLD(), 0.45, 0.0, -0.06));
    this.door.add(leaf);
    brd.add(this.door);
    // window wall with a skyline (right side)
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: skylineTex() }));
    sky.position.set(5.2, 2.2, 0); sky.rotation.y = -Math.PI / 2; sky.layers.set(NOINK);
    brd.add(sky);
    for (let z = -7; z <= 7; z += 2) brd.add(box(0.12, 4.2, 0.12, col("bb_mullion", "#2d3240"), 4.6, 2.1, z));
    brd.add(box(0.2, 0.5, 16, col("bb_mullion", "#2d3240"), 4.6, 0.25, 0));
    // screen
    this.screen = sign(3.4, 1.7, screenTex("meeting"), "#1b1d24");
    this.screen.g.position.set(0.0, 2.75, 6.86); this.screen.g.rotation.y = Math.PI;
    brd.add(this.screen.g);
    // table + chairs
    const woodD = col("bb_tablewood", "#5b3420");
    brd.add(box(1.6, 0.08, 8.0, woodD, 0, 0.76, 0.45), box(1.64, 0.03, 8.04, GOLD(), 0, 0.715, 0.45));
    brd.add(box(0.5, 0.7, 6.0, col("bb_tablebase", "#3a2216"), 0, 0.36, 0.45));
    const chairM = col("bb_chair", "#2a2c35");
    const seatZ = [-2.6, -0.9, 0.8, 2.5];
    const execStyles: RigStyle[] = [
      { jacket: "#2e3a56", tie: "#c93b3b", hair: "#2e241f" },
      { jacket: "#4a4f5c", tie: "#3f8fd1", hair: "#bdbdbd", moustache: "#bdbdbd" },
      { jacket: "#2d4a3a", tie: "#e8c45a", hair: "#7a4a2a" },
      { jacket: "#5a2e3e", tie: "#f0f0f0", hair: "#1f1a18" },
      { jacket: "#30343f", tie: "#e07b39", hair: "#e3c26a" },
      { jacket: "#3b5998", tie: "#c93b3b", hair: "#3b2a1e", moustache: "#3b2a1e" },
      { jacket: "#454545", tie: "#9b6fd1", hair: "#8c8c8c" },
      { jacket: "#2b4a6b", tie: "#5aa36b", hair: "#5a3b2a" },
    ];
    let k = 0;
    for (const sx of [-1, 1]) for (const z of seatZ) {
      brd.add(box(0.55, 0.1, 0.55, chairM, 1.25 * sx, 0.45, z), box(0.1, 0.9, 0.55, chairM, 1.55 * sx, 0.95, z), cyl(0.04, 0.04, 0.4, chairM, 1.25 * sx, 0.22, z, 6));
      const rig = new HeroRig25D(brd, execStyles[k++]);
      const lampG = makeLampshade();
      rig.headPivot.add(lampG);
      this.execs.push({ rig, pos: [1.2 * sx, -0.24, z], yaw: -sx * Math.PI / 2, lamp: lampG });
    }
    // CEO throne
    brd.add(box(0.8, 0.12, 0.7, col("bb_velvet", "#5b2a86"), 0, 0.5, 6.0), box(0.9, 1.9, 0.14, GOLD(), 0, 1.4, 6.38));
    this.sandwich = makeSandwich(0.8);
    R.add(this.sandwich);
    this.heroRich = new HeroRig25D(R, { jacket: "#6a3fa0", tie: "#e8c45a", hair: "#3b2a1e" });
    this.heroLamp = makeLampshade();
    this.heroRich.headPivot.add(this.heroLamp);

    // ================= 4. STREET (night) =================
    // Sidewalk z -3..2.6, road z 2.6..10, buildings across (z 12.5) and behind (z -4). Cart at (0, 0, 1.3), Sal behind it.
    const st = this.sets.street;
    st.add(box(40, 0.12, 5.6, col("bb_sidewalk", "#b9b4a8"), 0, 0.0, -0.2));
    for (let x = -20; x <= 20; x += 1.4) st.add(box(0.03, 0.005, 5.6, col("bb_sidejoint", "#8f8a80"), x, 0.062, -0.2));
    st.add(box(40, 0.16, 0.25, col("bb_curb", "#d4cfc3"), 0, 0.02, 2.6));
    st.add(box(40, 0.06, 8, col("bb_road", "#3a3d4a"), 0, -0.02, 6.6));
    for (let x = -18; x <= 18; x += 4.5) st.add(box(2.2, 0.01, 0.16, col("bb_dash", "#f5e9c8"), x, 0.02, 6.6));
    st.add(box(40, 0.12, 2.5, col("bb_sidewalk", "#b9b4a8"), 0, 0.0, 11.3));
    const bcols = ["#6b4f6e", "#4f5f7a", "#7a5a45", "#3f5a5a", "#5e4a7a"];
    for (let i = 0; i < 9; i++) {
      const bx = -20 + i * 5, h = 8 + hash(i) * 8;
      const fm = texMat("bb_bldA" + i, nightFacade("A" + (i % 5), bcols[i % 5]));
      const b = box(4.8, h, 5, fm, bx, h / 2, 15.2); st.add(b);
      const h2 = 7 + hash(i + 7) * 7;
      const b2 = box(4.8, h2, 5, texMat("bb_bldB" + i, nightFacade("B" + (i % 5), bcols[(i + 2) % 5])), bx + 2.5, h2 / 2, -6.0); st.add(b2);
    }
    this.streetGlows = glow(2.8, 2.2, 1.2);
    for (const lx of [-3.2, 6.0]) {
      st.add(cyl(0.07, 0.09, 4.2, col("bb_pole", "#3a3f4a"), lx, 2.1, 2.35, 8), box(0.9, 0.07, 0.1, col("bb_pole", "#3a3f4a"), lx + 0.4, 4.15, 2.35));
      const lb = ball(0.17, this.streetGlows, lx + 0.8, 4.0, 2.35); lb.layers.set(NOINK); st.add(lb);
    }
    // hot-dog cart
    const steel = shiny("steel", "#c3cad3", "#ffffff", 70);
    st.add(box(1.8, 0.65, 0.8, steel, 0, 0.68, 1.3), box(1.86, 0.05, 0.86, col("bb_cartedge", "#d8373a"), 0, 1.02, 1.3));
    st.add(box(1.2, 0.08, 0.5, col("bb_grill", "#2a2b30"), -0.15, 1.06, 1.35));
    for (let i = 0; i < 5; i++) {
      const dog = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.16, 4, 8).rotateZ(Math.PI / 2), col("bb_dog", "#b0502e"));
      dog.position.set(-0.55 + i * 0.2, 1.12, 1.3 + (i % 2) * 0.1); st.add(dog);
    }
    st.add(cyl(0.035, 0.035, 0.18, col("bb_mustard", "#f2c818"), 0.6, 1.13, 1.2, 10), cyl(0.035, 0.035, 0.18, col("bb_ketchup", "#d8262f"), 0.7, 1.13, 1.2, 10));
    const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 18).rotateZ(Math.PI / 2);
    for (const wx of [-0.95, 0.95]) { const w = new THREE.Mesh(wGeo, col("bb_dark", "#2a2d36")); w.position.set(wx, 0.3, 1.3); st.add(w); }
    const cs = sign(1.4, 0.44, cartSignTex(), "#f8f1de");
    cs.g.position.set(0, 0.66, 0.88); cs.g.rotation.y = Math.PI; st.add(cs.g);
    st.add(cyl(0.025, 0.025, 1.6, col("bb_pole", "#3a3f4a"), 0.78, 1.8, 1.62, 8));
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.45, 16, 1, true), lam("bb_umbrella", () => ({ map: awningTex(), side: THREE.DoubleSide })));
    um.position.set(0.78, 2.72, 1.62); um.castShadow = true; st.add(um);
    // check, checkbook, pen
    this.check = sign(0.5, 0.22, checkTex(), "#e6f1df");
    this.checkbook = new THREE.Group();
    this.checkbook.add(box(0.26, 0.012, 0.13, col("bb_cbook", "#2e6b45")), box(0.25, 0.006, 0.12, col("bb_cpage", "#e6f1df"), 0, 0.009, 0));
    this.pen = box(0.012, 0.012, 0.15, col("bb_pen", "#e8c45a"));
    R.add(this.check.g, this.checkbook, this.pen);

    this.sal = new HeroRig25D(st, { jacket: "#e9e4da", apron: "#c8473d", hair: "#d9d9d9", moustache: "#eeeeee", skin: "#f5c9a0" });
    this.sal.headPivot.add(makePaperHat());
    this.heroHood = new HeroRig25D(st, { jacket: "#7d838c", hair: "#3b2a1e" });
    this.heroHood.headPivot.add(makeHood("#7d838c"));

    this.butler = new HeroRig25D(R, { jacket: "#1f2230", tie: "#151520", hair: "#cfcfcf", moustache: "#cfcfcf" });
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

  /** Place a held prop between a rig's hands, facing the rig's forward (+z rotated by yaw) */
  private holdBetween(rig: HeroRig25D, obj: THREE.Object3D, yaw: number, fwd = 0.04, dy = 0, pitch = 0) {
    rig.handWorld("L", this.tmpV); rig.handWorld("R", this.tmpV2);
    obj.position.copy(this.tmpV).add(this.tmpV2).multiplyScalar(0.5);
    obj.position.x += Math.sin(yaw) * fwd; obj.position.z += Math.cos(yaw) * fwd; obj.position.y += dy;
    obj.rotation.set(0, yaw, 0);
    obj.rotateX(pitch);
    obj.visible = true;
  }

  private holdIn(rig: HeroRig25D, side: "L" | "R", obj: THREE.Object3D, yaw: number, dy = 0, pitch = 0) {
    rig.handWorld(side, this.tmpV);
    obj.position.copy(this.tmpV); obj.position.y += dy;
    obj.rotation.set(0, yaw, 0);
    obj.rotateX(pitch);
    obj.visible = true;
  }

  /** head yaw (clamped) for a rig at pos/yaw to look at a world point */
  private lookYaw(pos: P3, yaw: number, target: P3, lim = 1.1) {
    const a = wrapA(Math.atan2(target[0] - pos[0], target[2] - pos[2]) - yaw);
    return Math.max(-lim, Math.min(lim, a));
  }

  /** alternating walk-cycle feet / arm swing (local space) */
  private walkLimbs(ph: number, amp = 1): Partial<RigPose> {
    const s = Math.sin(ph) * amp;
    return {
      footL: [-0.12, 0.04 + 0.07 * Math.max(0, Math.sin(ph)) * amp, 0.05 + 0.2 * s],
      footR: [0.12, 0.04 + 0.07 * Math.max(0, -Math.sin(ph)) * amp, 0.05 - 0.2 * s],
      handL: [-0.27, 0.74, 0.1 - 0.16 * s],
      handR: [0.27, 0.74, 0.1 + 0.16 * s],
    };
  }

  private poseBedroom(id: number, f: number, t: number) {
    const night = id === 5;
    for (const m of this.windowMats) m.map = windowView(night);
    this.bedLamp.color.setRGB(night ? 2.6 : 1.2, night ? 1.9 : 1.0, night ? 1.0 : 0.7);
    this.chandelier.color.setRGB(night ? 0.5 : 2.4, night ? 0.4 : 1.9, night ? 0.25 : 1.1);
    const pos: P3 = [0, 0.06, 2.75], yaw = Math.PI;
    if (id === 1 || id === 2) {
      const k = id === 1 ? sitUpK(f) : 1;
      const lean = -1.35 * (1 - k) + 0.04 * k;
      const shock = id === 1 ? f >= 38 && f < 95 : false;
      this.heroPJ.pose({
        pos, yaw, lean, armsFollowLean: true,
        expr: id === 1 ? (f < 38 ? "neutral" : shock ? "shock" : "grin") : f < 150 ? "shock" : "grin",
        blink: id === 1 && f < 38 ? 1 : Math.floor(f / 3) % 41 === 0 ? 1 : 0,
        headPitch: id === 2 ? -0.05 : 0.1 * (1 - k),
        headYaw: id === 2 ? -0.55 : 0,
        footL: [-0.14, 0.78, 0.95], footR: [0.14, 0.78, 0.95],
        handL: k > 0.5 ? [-0.36, 0.95 + 0.25 * (shock ? 1 : 0), 0.3] : [-0.3, 0.85, 0.45],
        handR: k > 0.5 ? [0.36, 0.95 + 0.25 * (shock ? 1 : 0), 0.3] : [0.3, 0.85, 0.45],
      });
    }
    if (id === 2) {
      // butler beside the bed, tray held out; the clock rattles (alarm_ring f140)
      const bPos: P3 = [-2.6, 0, 2.35], bYaw = Math.PI / 2 - 0.1;
      this.butler.pose({ pos: bPos, yaw: bYaw, expr: "neutral", headYaw: 0.05,
        handL: [-0.17, 1.12, 0.42], handR: [0.17, 1.12, 0.42] });
      this.holdBetween(this.butler, this.tray, bYaw, 0.06, 0.0);
      const ring = f >= 138 && f < 205 ? 1 : 0;
      this.clock.rotation.set(0, 0.4, ring * 0.12 * Math.sin(f * 2.6));
      this.clock.position.x = ring * 0.008 * Math.sin(f * 3.3);
    }
    if (id === 5) {
      // night: hero sits up in bed, phone glowing in his hand, buzzing more and more
      const buzz = [506, 532, 556, 574, 590, 602].some((b) => f >= b && f < b + 7) ? 1 : 0;
      this.heroPJ.pose({ pos, yaw, lean: 0.06, expr: f < 560 ? "neutral" : "shock",
        blink: Math.floor(f / 3) % 37 === 0 ? 1 : 0, headPitch: 0.18,
        footL: [-0.14, 0.78, 0.95], footR: [0.14, 0.78, 0.95],
        handL: [-0.3, 0.95, 0.35], handR: [0.1, 1.14, 0.42] });
      this.holdIn(this.heroPJ, "R", this.phone, Math.PI, 0.07, -0.35);
      this.phone.position.x += buzz * 0.006 * Math.sin(f * 4.1);
    }
  }

  private poseEstate(id: number, f: number, t: number) {
    const night = id === 6;
    this.gateLamps.color.setRGB(night ? 2.8 : 0.8, night ? 2.1 : 0.7, night ? 1.0 : 0.5);
    this.mansionWin.color.setRGB(night ? 2.2 : 0.3, night ? 1.6 : 0.35, night ? 0.75 : 0.45);
    this.heli.rotor.rotation.y = id === 3 ? 0.012 * (f - 295) ** 1.55 : 0.3;
    this.car.visible = id !== 3;
    this.coat.visible = false;
    if (id === 3) {
      const bPos: P3 = [-4.3, 0, -2.0];
      this.butler.pose({ pos: bPos, yaw: 2.85, expr: "neutral", mouthOpen: mouthAt(TALK.butler, f),
        headYaw: -0.05, handL: [-0.22, 0.95, 0.18],
        handR: f > 340 ? [0.42, 1.25, 0.2] : [0.22, 0.95, 0.18] }); // gestures back at the chopper
    } else if (id === 4) {
      this.car.position.set(carX(f), 0, 1.4);
      this.car.rotation.set(0, Math.PI / 2, 0);
      const cheer = f >= 410 ? Math.abs(Math.sin(t * 7)) : 0;
      const hPos: P3 = [1.9, 0, -0.3];
      this.heroRich.pose({ pos: hPos, yaw: Math.PI - 0.25, expr: f < 409 ? "grin" : "laugh",
        headYaw: f < 409 ? this.lookYaw(hPos, Math.PI - 0.25, [carX(f), 1, 1.4]) : 0.2,
        handL: f >= 410 ? [-0.32, 1.55 + 0.1 * cheer, 0.12] : [-0.26, 0.74, 0.12],
        handR: f >= 410 ? [0.32, 1.55 + 0.1 * (1 - cheer), 0.12] : [0.26, 0.74, 0.12] });
      this.heroLamp.visible = false;
    } else if (id === 6) {
      this.car.position.set(0, 0, 1.4); this.car.rotation.set(0, Math.PI, 0);
      // cousins at the gate; the front one presses in, holding up a coat
      const spots: P3[] = [[0.05, 0, -12.45], [-1.15, 0, -12.7], [1.2, 0, -12.65], [-2.2, 0, -13.1], [2.25, 0, -13.05]];
      this.cousins.forEach((c, i) => {
        const w = Math.sin(t * 8 + i * 1.7);
        const p = spots[i];
        const main = i === 0;
        c.pose({ pos: p, yaw: 0.05 * (i - 2), expr: main ? (f < 700 ? "grin" : "laugh") : i % 2 ? "grin" : "smile",
          mouthOpen: main ? mouthAt(TALK.cousin, f) : 0.3 * Math.abs(w),
          lean: main ? 0.12 : 0.04,
          handL: main ? [-0.22, 1.42, 0.38] : [-0.34, 1.55 + 0.12 * w, 0.12],
          handR: main ? [0.32, 1.25 + 0.06 * Math.abs(w), 0.36] : [0.34, 1.55 - 0.12 * w, 0.12] });
      });
      this.holdIn(this.cousins[0], "R", this.coat, 0, -0.2);
      this.coat.rotation.z = 0.1 * Math.sin(t * 6);
    } else if (id === 11) {
      this.car.position.set(0, 0, 1.4); this.car.rotation.set(0, Math.PI, 0);
      const hPos: P3 = [21.75, -0.37, -0.5], hYaw = Math.PI / 2;
      this.heroRich.pose({ pos: hPos, yaw: hYaw, expr: "neutral", lean: 0.12, headPitch: 0.12,
        blink: Math.floor(f / 3) % 43 === 0 ? 1 : 0,
        footL: [-0.12, 0.08, 0.42], footR: [0.12, 0.05, 0.46],
        handL: [-0.3, 0.72, 0.05], handR: [0.3, 0.72, 0.05] });
      this.heroLamp.visible = false;
    }
  }

  private poseBoardroom(id: number, f: number, t: number) {
    this.door.rotation.y = id === 9 ? -1.55 * smooth((f - 1104) / 14) : 0;
    this.screen.mat.map = screenTex(id === 7 ? "meeting" : id === 8 ? (f < 999 ? "pitch" : "funded") : id === 9 ? "funded" : "lamps");
    this.heroLamp.visible = id === 9;
    const head: P3 = [0, 1.55, 5.35];
    // CEO pose
    let hPos: P3 = [0, 0, 5.35], hYaw = Math.PI;
    if (id === 9) {
      const k = walkInK(f);
      const p0: P3 = [-3.3, 0, 7.9], p1: P3 = [-2.9, 0, 6.0], p2: P3 = [-0.7, 0, 5.4];
      const seg = k < 0.45 ? k / 0.45 : (k - 0.45) / 0.55;
      const [a, b] = k < 0.45 ? [p0, p1] : [p1, p2];
      hPos = [a[0] + (b[0] - a[0]) * seg, 0, a[2] + (b[2] - a[2]) * seg];
      const travel = k < 0.45 ? Math.atan2(p1[0] - p0[0], p1[2] - p0[2]) : Math.atan2(p2[0] - p1[0], p2[2] - p1[2]);
      hYaw = k >= 1 ? Math.PI : travel + (Math.PI - travel) * smooth((k - 0.8) / 0.2);
      const walking = k > 0 && k < 1;
      this.heroRich.pose({ pos: hPos, yaw: hYaw, expr: k < 1 ? "neutral" : "grin",
        ...(walking ? this.walkLimbs((f - 1112) * 0.5) : { handL: [-0.26, 0.74, 0.12], handR: [0.26, 0.74, 0.12] }) });
      this.heroRich.root.position.y = walking ? 0.025 * Math.abs(Math.sin((f - 1112) * 0.5)) : 0;
    } else if (id === 7) {
      this.heroRich.pose({ pos: hPos, yaw: hYaw, expr: "grin", mouthOpen: mouthAt(TALK.hero, f),
        handL: [-0.3, 1.0, 0.25], handR: [0.34, 1.2 + 0.08 * Math.sin(t * 5), 0.3] });
    } else if (id === 8) {
      const lift = smooth((f - 940) / 18);
      this.heroRich.pose({ pos: hPos, yaw: hYaw, expr: f >= 999 ? "laugh" : "grin", mouthOpen: mouthAt(TALK.hero, f),
        handL: [-0.2, 1.05 + 0.75 * lift, 0.32], handR: [0.2, 1.05 + 0.75 * lift, 0.32] });
      this.holdBetween(this.heroRich, this.sandwich, hYaw, 0.0, 0.0);
    } else {
      this.heroRich.pose({ pos: hPos, yaw: hYaw, expr: "neutral", headYaw: 0.15 * Math.sin(t * 0.8),
        blink: Math.floor(f / 3) % 31 === 0 ? 1 : 0, handL: [-0.26, 0.74, 0.12], handR: [0.26, 0.74, 0.12] });
    }
    // execs
    const lookAt: P3 = [hPos[0], 1.55, hPos[2]];
    this.execs.forEach((e, i) => {
      const ph = t * 9 + i * 1.3;
      const laughing = id === 7 || (id === 8 && f >= 1000);
      const clapping = id === 9 && f >= 1176;
      const lampsOn = id === 10;
      e.lamp.visible = lampsOn;
      const la = laughing ? Math.abs(Math.sin(ph)) : 0;
      const clap = clapping ? Math.abs(Math.sin(t * 14 + i)) : 1;
      const hy = this.lookYaw(e.pos, e.yaw, id === 9 && f < 1150 ? [-3.0, 1.5, 6.5] : lookAt);
      e.rig.pose({
        pos: [e.pos[0], e.pos[1] + 0.02 * la, e.pos[2]], yaw: e.yaw,
        lean: laughing ? -0.12 + 0.18 * la : id === 9 && f >= 1166 && f < 1176 ? -0.1 : 0.04,
        expr: laughing ? "laugh" : id === 9 ? (f < 1166 ? "neutral" : f < 1176 ? "shock" : "grin") : id === 10 ? "smile" : "grin",
        mouthOpen: laughing ? 0.35 + 0.5 * la : clapping ? 0.4 : 0,
        headYaw: hy, headPitch: laughing ? -0.15 * la : 0,
        blink: Math.floor(f / 3 + i * 5) % 37 === 0 ? 1 : 0,
        footL: [-0.12, 0.28, 0.42], footR: [0.12, 0.28, 0.42],
        handL: clapping ? [-0.05 - 0.09 * clap, 1.15, 0.36] : laughing && i % 3 === 0 ? [-0.1, 1.0 + 0.1 * la, 0.2] : [-0.18, 1.04, 0.42],
        handR: clapping ? [0.05 + 0.09 * clap, 1.15, 0.36] : laughing && i % 2 === 0 ? [0.3, 1.0 + 0.15 * la, 0.3] : [0.18, 1.04, 0.42],
      });
    });
  }

  private poseStreet(id: number, f: number, t: number) {
    const salPos: P3 = [0, 0, 2.15], salYaw = Math.PI;
    const heroAt: P3 = [0, 0, 0.15];
    // Sal
    const salExpr = id === 14 ? "stern" : id === 16 ? "dazed" : id === 15 && f < 1790 ? "neutral" : "stern";
    let salHL: P3 = [-0.24, 1.05, 0.45], salHR: P3 = [0.24, 1.05, 0.45];
    if (id === 12 || id === 13) { salHL = [-0.3, 1.08, 0.5]; salHR = [0.15, 1.12 + 0.03 * Math.sin(t * 4), 0.5]; } // tending the grill
    if (id === 15 && f >= 1838) { const k = smooth((f - 1838) / 12); salHR = [0.06, 1.05 + 0.2 * k, 0.45 + 0.35 * k]; }
    if (id === 16) { salHL = [-0.2, 1.28, 0.42]; salHR = [0.2, 1.28, 0.42]; }
    this.sal.pose({ pos: salPos, yaw: salYaw, expr: salExpr, mouthOpen: mouthAt(TALK.sal, f, 10),
      headPitch: id === 16 ? 0.12 : 0, blink: Math.floor(f / 3) % 39 === 0 ? 1 : 0,
      headYaw: id === 12 ? -0.3 : 0, handL: salHL, handR: salHR });
    if (id === 16) {
      this.holdBetween(this.sal, this.check.g, salYaw, 0.02, 0.0, -0.1);
    }
    // hero in the hoodie
    if (id === 12) {
      const x = walkX(f), walking = f < 1550;
      const turn = smooth((f - 1546) / 14);
      const hPos: P3 = [x, 0, 0.15];
      this.heroHood.pose({ pos: hPos, yaw: Math.PI / 2 * (1 - turn), expr: "neutral", headPitch: 0.1,
        headYaw: walking ? -0.25 : 0, blink: Math.floor(f / 3) % 33 === 0 ? 1 : 0,
        ...(walking ? this.walkLimbs((f - 1446) * 0.42, 0.9) : { handL: [-0.2, 0.85, 0.2], handR: [0.2, 0.85, 0.2] }) });
      this.heroHood.root.position.y = walking ? 0.025 * Math.abs(Math.sin((f - 1446) * 0.42)) : 0;
    } else {
      let hl: P3 = [-0.2, 0.85, 0.2], hr: P3 = [0.2, 0.85, 0.2];
      let expr: "neutral" | "smile_closed" | "grin" | "smile" = "neutral";
      if (id === 13) { hr = f >= 1595 ? [0.3, 1.15 + 0.05 * Math.sin(t * 6), 0.35] : hr; } // asks, gesturing
      if (id === 15) {
        expr = f < 1785 ? "smile_closed" : "grin";
        if (f >= 1786 && f < 1840) { hl = [-0.12, 1.0, 0.42]; hr = [0.06 + 0.03 * Math.sin(f * 1.7), 1.04 + 0.015 * Math.cos(f * 2.3), 0.44]; }
        else if (f >= 1840) { const k = smooth((f - 1840) / 10); hl = [-0.2, 0.85, 0.2]; hr = [0.05, 1.05, 0.44 + 0.3 * k]; }
      }
      this.heroHood.pose({ pos: heroAt, yaw: 0, expr, mouthOpen: id === 13 ? mouthAt(TALK.salAsked, f, 11) : 0,
        headPitch: id === 15 && f < 1785 ? -0.08 : 0, blink: Math.floor(f / 3) % 35 === 0 ? 1 : 0, handL: hl, handR: hr });
      if (id === 15 && f >= 1786 && f < 1840) {
        this.holdIn(this.heroHood, "L", this.checkbook, 0, 0.0, 0);
        this.holdIn(this.heroHood, "R", this.pen, 0, 0.03, -0.9);
      }
      if (id === 15 && f >= 1840) {
        // the torn-out check travels from his hand into Sal's
        const k = smooth((f - 1840) / 14);
        this.heroHood.handWorld("R", this.tmpV);
        this.check.g.position.copy(this.tmpV).add(new THREE.Vector3(0, 0.06, 0.12 * k));
        this.check.g.rotation.set(-0.3, 0, 0);
        this.check.g.visible = true;
      }
    }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = s.set === "estate" ? 30 : 16;
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
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog;

    // reset actors & held props
    for (const r of [this.heroPJ, this.heroRich, this.heroHood, this.butler, this.sal, ...this.cousins, ...this.execs.map((e) => e.rig)]) r.root.visible = false;
    for (const o of [this.tray, this.phone, this.sandwich, this.check.g, this.checkbook, this.pen]) o.visible = false;

    if (s.set === "bedroom") this.poseBedroom(id, f, t);
    else if (s.set === "estate") this.poseEstate(id, f, t);
    else if (s.set === "boardroom") this.poseBoardroom(id, f, t);
    else this.poseStreet(id, f, t);
    if (s.set === "street") { this.sal.root.visible = true; }
    return focus;
  }
}
