// Modular 3D Set Registry for "What If You Woke Up 10 Years in the Future?": hospital, apartment (2026 flashback), city (2036).
// Only the active shot's set Group is visible per frame; the cast (you, the bots, the pedestrians) lives on the world root
// and is posed per shot. Readable props (wall screen, phone, laptop, ATM, register, menu, billboards) use unlit
// MeshBasicMaterial faces on NOINK; characters, beard, sky and glows sit on NOINK too.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { twoTone, untone, TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { cardShade } from "../core/cardshade";
import { HeroRig25D, RigPose, RigStyle } from "../core/rig25d";
import { BARISTA, CURB, FPS, HERO_KIOSK, SHOTS, V3, camAt, droneP, lerp, runZ, smooth, taxiSwoop } from "./story";

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
const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
/** deterministic 0..1 hash (stable across renders / chunks) */
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const UP = new THREE.Vector3(0, 1, 0);

/** Unlit readable face: textured plane + lam backing card (the card still gets an ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#f4efe3", depth = 0.025) => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, depth, col("tf_sign_back_" + backHex, backHex), 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = depth / 2 + 0.002;
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};

/** a CanvasTexture we redraw ourselves whenever its state key changes */
class LiveTex {
  cv = document.createElement("canvas");
  tex: THREE.CanvasTexture;
  private key = "";
  constructor(w: number, h: number, private draw: (g: CanvasRenderingContext2D, key: string) => void) {
    this.cv.width = w; this.cv.height = h;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
  }
  set(key: string) {
    if (key === this.key) return;
    this.key = key;
    this.draw(this.cv.getContext("2d")!, key);
    this.tex.needsUpdate = true;
  }
}

// ---------------- painted textures ----------------
const potato = (g: CanvasRenderingContext2D, x: number, y: number, s: number, face = true) => {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = "#c9944f"; g.strokeStyle = "#241726"; g.lineWidth = 6;
  g.beginPath(); g.ellipse(0, 0, 60, 44, -0.25, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#a57538";
  for (const [dx, dy] of [[-30, -16], [22, 18], [34, -14], [-12, 24]]) { g.beginPath(); g.arc(dx, dy, 4.5, 0, Math.PI * 2); g.fill(); }
  if (face) {
    g.fillStyle = "#241726";
    g.beginPath(); g.arc(-14, -6, 6, 0, Math.PI * 2); g.arc(14, -10, 6, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.beginPath(); g.arc(0, 4, 16, 0.25, Math.PI - 0.25); g.stroke();
  }
  g.restore();
};
const calendarTex = () => ctex("tf_calendar", 512, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, "#0e2a44"); gr.addColorStop(1, "#18465e");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.textAlign = "center"; g.fillStyle = "#9fe8ff"; g.font = "bold 34px sans-serif"; g.fillText("TUE  ·  NOV 18", 256, 56);
  g.fillStyle = "#ffffff"; g.font = "bold 150px sans-serif"; g.fillText("2036", 256, 196);
  g.fillStyle = "#4fd6ff"; g.fillRect(40, 220, 432, 6);
});
const monitorTex = () => ctex("tf_monitor", 256, 192, (g) => {
  g.fillStyle = "#0b1a14"; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = "#45f08a"; g.lineWidth = 4; g.beginPath();
  for (let x = 0; x <= 256; x += 4) { const p = x % 64; const y = p > 26 && p < 30 ? 30 : p >= 30 && p < 34 ? 92 : 64 + Math.sin(x * 0.2) * 2; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = "#45f08a"; g.font = "bold 30px monospace"; g.textAlign = "left"; g.fillText("♥ 72", 14, 138);
  g.fillStyle = "#ffd447"; g.font = "bold 19px monospace"; g.fillText("DAYS ASLEEP: 3,653", 14, 174);
});
const hospWindowTex = () => ctex("tf_hosp_window", 512, 448, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 448); gr.addColorStop(0, "#7fb8ec"); gr.addColorStop(1, "#d6ecff");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 448);
  const towers: [number, number, number, string][] = [[10, 70, 300, "#c9d8f0"], [90, 60, 380, "#f0d6e8"], [160, 90, 250, "#d4f0e4"], [260, 50, 420, "#e8e2f8"], [320, 80, 320, "#cfe6f5"], [410, 90, 280, "#f5e6cf"]];
  for (const [x, w, h, c] of towers) {
    g.fillStyle = c; g.fillRect(x, 448 - h, w, h); g.beginPath(); g.ellipse(x + w / 2, 448 - h, w / 2, 16, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6fd9ff"; for (let y = 448 - h + 30; y < 440; y += 26) g.fillRect(x + 6, y, w - 12, 6);
  }
  const cars: [number, number, string][] = [[120, 120, "#ff5d73"], [300, 80, "#ffd447"], [420, 170, "#5dd1ff"], [60, 210, "#9f7bff"]];
  for (const [x, y, c] of cars) {
    g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#bff4ff"; g.beginPath(); g.ellipse(x + 4, y - 7, 11, 6, 0, Math.PI, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 30, y); g.lineTo(x - 70, y + 2); g.stroke();
  }
});
const nightWindowTex = () => ctex("tf_night_window", 512, 448, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 448); gr.addColorStop(0, "#0a1230"); gr.addColorStop(1, "#24305e");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 448);
  g.fillStyle = "#fff6d0"; g.beginPath(); g.arc(400, 80, 34, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 40; i++) { g.fillRect(hash(i) * 512, hash(i * 3) * 220, 2, 2); }
  for (let i = 0; i < 9; i++) {
    const x = i * 60 - 10, w = 50, h = 120 + hash(i * 7) * 180;
    g.fillStyle = "#151c3a"; g.fillRect(x, 448 - h, w, h);
    g.fillStyle = "#ffd77a"; for (let y = 448 - h + 14; y < 440; y += 22) for (let c = 0; c < 3; c++) if (hash(i * 13 + y + c) > 0.45) g.fillRect(x + 6 + c * 15, y, 8, 10);
  }
});
const posterTex = () => ctex("tf_poster", 300, 420, (g) => {
  g.fillStyle = "#1b2350"; g.fillRect(0, 0, 300, 420);
  g.fillStyle = "#fff6d0"; g.beginPath(); g.arc(220, 90, 50, 0, Math.PI * 2); g.fill();
  g.save(); g.translate(120, 250); g.rotate(-0.6);
  g.fillStyle = "#e8e8f0"; g.beginPath(); g.ellipse(0, 0, 26, 70, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e5483d"; g.beginPath(); g.moveTo(-26, 30); g.lineTo(-48, 76); g.lineTo(-10, 60); g.fill(); g.beginPath(); g.moveTo(26, 30); g.lineTo(48, 76); g.lineTo(10, 60); g.fill();
  g.fillStyle = "#ffb03a"; g.beginPath(); g.moveTo(-16, 70); g.lineTo(0, 120); g.lineTo(16, 70); g.fill();
  g.fillStyle = "#4fb8ff"; g.beginPath(); g.arc(0, -16, 12, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = "#ffd447"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.fillText("TO THE", 150, 362); g.fillText("MOON", 150, 408);
});
const billboardTex = (golden: boolean) => ctex("tf_billboard_" + (golden ? "g" : "d"), 1024, 340, (g) => {
  g.fillStyle = golden ? "#2b1648" : "#1a1340"; g.fillRect(0, 0, 1024, 340);
  g.strokeStyle = "#ffd447"; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 320);
  potato(g, 150, 170, 1.7);
  g.textAlign = "center";
  if (golden) {
    g.fillStyle = "#ffd447"; g.font = "bold 70px sans-serif"; g.fillText("CONGRATS!", 620, 110);
    g.fillStyle = "#ffffff"; g.font = "bold 58px sans-serif"; g.fillText("EVERYONE IS NOW", 620, 190); g.fillText("A MILLIONAIRE", 620, 260);
  } else {
    g.fillStyle = "#ffd447"; g.font = "bold 92px sans-serif"; g.fillText("POTATOCOIN", 620, 140);
    g.fillStyle = "#7dff9a"; g.font = "bold 66px sans-serif"; g.fillText("+2,000,000%", 620, 230);
    g.fillStyle = "#ffffff"; g.font = "bold 34px sans-serif"; g.fillText("THE PEOPLE'S CURRENCY", 620, 290);
  }
});
const sideAdTex = (key: string, l1: string, l2: string, bg: string) => ctex("tf_ad_" + key, 512, 768, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 512, 768);
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.font = "bold 74px sans-serif";
  l1.split("|").forEach((s, i) => g.fillText(s, 256, 170 + i * 86));
  g.fillStyle = "#ffd447"; g.font = "bold 70px sans-serif"; l2.split("|").forEach((s, i) => g.fillText(s, 256, 540 + i * 84));
});
const atmSignTex = () => ctex("tf_atm_sign", 512, 160, (g) => {
  g.fillStyle = "#1a1340"; g.fillRect(0, 0, 512, 160);
  potato(g, 80, 80, 0.85);
  g.fillStyle = "#ffd447"; g.font = "bold 58px sans-serif"; g.textAlign = "left"; g.fillText("POTATOCOIN", 150, 80);
  g.fillStyle = "#ffffff"; g.font = "bold 40px sans-serif"; g.fillText("ATM", 150, 128);
});
const kioskSignTex = () => ctex("tf_kiosk_sign", 768, 180, (g) => {
  g.fillStyle = "#3a2318"; g.fillRect(0, 0, 768, 180);
  g.fillStyle = "#f6e7cf"; g.font = "bold 92px sans-serif"; g.textAlign = "center"; g.fillText("FUTURE BEANS", 384, 116);
  g.fillStyle = "#6fd9ff"; g.font = "bold 30px sans-serif"; g.fillText("ROBO-BARISTA · EST. 2034", 384, 160);
});
const menuTex = () => ctex("tf_menu", 512, 384, (g) => {
  g.fillStyle = "#1d2a26"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#f6e7cf"; g.lineWidth = 6; g.strokeRect(10, 10, 492, 364);
  g.fillStyle = "#f6e7cf"; g.font = "bold 48px sans-serif"; g.textAlign = "center"; g.fillText("MENU", 256, 66);
  const rows: [string, string][] = [["SMALL COFFEE", "$4,000,000"], ["LATTE", "$6,500,000"], ["DONUT", "$2,250,000"], ["WATER", "$900,000"]];
  rows.forEach(([a, b], i) => {
    const y = 132 + i * 66;
    g.textAlign = "left"; g.fillStyle = "#ffffff"; g.font = "bold 34px sans-serif"; g.fillText(a, 34, y);
    g.textAlign = "right"; g.fillStyle = "#ffd447"; g.fillText(b, 478, y);
  });
});
const pizzaTex = () => ctex("tf_pizza", 256, 256, (g) => {
  g.fillStyle = "#f4efe3"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#d63a2f"; g.fillRect(0, 0, 256, 40); g.fillRect(0, 216, 256, 40);
  g.fillStyle = "#d63a2f"; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.fillText("PIZZA", 128, 148);
});
const taxiTex = () => ctex("tf_taxi", 256, 96, (g) => {
  g.fillStyle = "#241726"; g.fillRect(0, 0, 256, 96);
  g.fillStyle = "#ffd447"; g.font = "bold 66px sans-serif"; g.textAlign = "center"; g.fillText("TAXI", 128, 72);
});
/** robot screen faces */
type BotFace = "eyes" | "blink" | "happy" | "flat" | "talk";
const botFaceTex = (kind: BotFace, eyeCol: string) => ctex(`tf_bot_${kind}_${eyeCol}`, 256, 160, (g) => {
  g.fillStyle = "#0d1626"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = eyeCol; g.strokeStyle = eyeCol; g.lineCap = "round";
  for (const ex of [82, 174]) {
    if (kind === "eyes" || kind === "talk") { g.beginPath(); g.roundRect(ex - 15, 40, 30, 48, 14); g.fill(); }
    else if (kind === "blink") { g.lineWidth = 9; g.beginPath(); g.moveTo(ex - 16, 66); g.lineTo(ex + 16, 66); g.stroke(); }
    else if (kind === "happy") { g.lineWidth = 10; g.beginPath(); g.arc(ex, 76, 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else { g.lineWidth = 11; g.beginPath(); g.moveTo(ex - 22, 60); g.lineTo(ex + 22, 60); g.stroke(); g.fillRect(ex - 22, 60, 44, 16); } // flat, unimpressed
  }
  if (kind === "talk") {
    g.lineWidth = 6; g.beginPath();
    for (let x = 70; x <= 186; x += 4) { const y = 122 + Math.sin(x * 0.35) * 10 * Math.sin(((x - 70) / 116) * Math.PI); if (x === 70) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  } else if (kind === "flat") {
    g.lineWidth = 7; g.beginPath(); g.moveTo(104, 126); g.lineTo(152, 126); g.stroke();
  } else {
    g.lineWidth = 6; g.beginPath(); g.arc(128, 104, 18, 0.3, Math.PI - 0.3); g.stroke();
  }
});
const beardTex = (hex: string) => ctex("tf_beard_" + hex, 256, 256, (g, r) => {
  g.fillStyle = hex; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    const x = r() * 256;
    g.strokeStyle = r() > 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.12)"; g.lineWidth = 2 + r() * 2;
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (r() - 0.5) * 30, 128, x + (r() - 0.5) * 20, 256); g.stroke();
  }
});

// ---- live screens ----
const money = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** phone app (Shot 11): "loading" -> chart rockets +2,000,000 % -> balance counts $200 -> $4,000,000 */
const drawPhone = (g: CanvasRenderingContext2D, key: string) => {
  const [st, val] = key.split("|");
  const stage = Number(st), bal = Number(val);
  const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, "#1a1340"); gr.addColorStop(1, "#2b1d5a");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 1024);
  potato(g, 96, 96, 0.75);
  g.fillStyle = "#ffd447"; g.font = "bold 58px sans-serif"; g.textAlign = "left"; g.fillText("PotatoCoin", 160, 112);
  g.textAlign = "center";
  if (stage === 0) {
    g.strokeStyle = "#ffd447"; g.lineWidth = 14; g.beginPath(); g.arc(256, 470, 70, 0, Math.PI * 1.4); g.stroke();
    g.fillStyle = "#ffffff"; g.font = "bold 44px sans-serif"; g.fillText("Loading...", 256, 620);
    return;
  }
  // chart: flat for years, then straight up
  g.fillStyle = "rgba(125,255,154,0.12)"; g.fillRect(40, 200, 432, 330);
  g.strokeStyle = "#7dff9a"; g.lineWidth = 12; g.lineJoin = "round"; g.beginPath();
  g.moveTo(50, 510); g.lineTo(150, 505); g.lineTo(230, 512); g.lineTo(300, 498); g.lineTo(350, 470); g.lineTo(390, 380); g.lineTo(420, 260); g.lineTo(450, 210);
  g.stroke();
  g.fillStyle = "#7dff9a"; g.beginPath(); g.moveTo(462, 186); g.lineTo(426, 214); g.lineTo(468, 232); g.fill();
  g.font = "bold 76px sans-serif"; g.fillText("+2,000,000%", 256, 650);
  g.fillStyle = "#ffffff"; g.font = "bold 40px sans-serif"; g.fillText("10 YEAR CHANGE", 256, 706);
  if (stage >= 2) {
    g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.roundRect(30, 760, 452, 210, 30); g.fill();
    g.fillStyle = "#cfc6ff"; g.font = "bold 38px sans-serif"; g.fillText("YOUR BALANCE", 256, 820);
    g.fillStyle = bal >= 4e6 ? "#ffd447" : "#ffffff"; g.font = `bold ${bal >= 1e6 ? 74 : 84}px sans-serif`; g.fillText(money(bal), 256, 920);
  }
};
/** laptop (2026 flashback, Shot 9/10): cursor drifts onto BUY, click, order filled */
const drawLaptop = (g: CanvasRenderingContext2D, key: string) => {
  const [st, cx, cy] = key.split("|").map(Number);
  g.fillStyle = "#f2f4fa"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#1a1340"; g.fillRect(0, 0, 1024, 90);
  potato(g, 70, 46, 0.5);
  g.fillStyle = "#ffd447"; g.font = "bold 46px sans-serif"; g.textAlign = "left"; g.fillText("PotatoCoin Exchange", 120, 62);
  g.textAlign = "center";
  if (st < 2) {
    potato(g, 512, 210, 1.2);
    g.fillStyle = "#241726"; g.font = "bold 40px sans-serif"; g.fillText("1 PTC = $0.0001", 512, 320);
    g.fillStyle = "#6b6f80"; g.font = "bold 30px sans-serif"; g.fillText("Amount: $200.00  (my entire savings)", 512, 372);
    g.fillStyle = st === 1 ? "#2a9a4a" : "#36c26a"; g.beginPath(); g.roundRect(352, 410, 320, 110, 24); g.fill();
    g.fillStyle = "#ffffff"; g.font = "bold 72px sans-serif"; g.fillText("BUY", 512, 490);
  } else {
    g.fillStyle = "#36c26a"; g.beginPath(); g.arc(512, 230, 90, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#ffffff"; g.lineWidth = 24; g.lineCap = "round"; g.beginPath(); g.moveTo(462, 232); g.lineTo(500, 270); g.lineTo(566, 196); g.stroke();
    g.fillStyle = "#241726"; g.font = "bold 50px sans-serif"; g.fillText("ORDER FILLED!", 512, 390);
    g.font = "bold 40px sans-serif"; g.fillText("You own 2,000,000 PotatoCoin", 512, 452);
    g.fillStyle = "#6b6f80"; g.font = "italic 30px sans-serif"; g.fillText("Remaining savings: $0.00", 512, 506);
  }
  // mouse cursor
  g.save(); g.translate(cx, cy); g.fillStyle = "#ffffff"; g.strokeStyle = "#111"; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 56); g.lineTo(14, 42); g.lineTo(26, 66); g.lineTo(36, 60); g.lineTo(24, 38); g.lineTo(42, 36); g.closePath(); g.fill(); g.stroke(); g.restore();
};
/** ATM screen: SELL ALL? -> SOLD $4,000,000.00 */
const drawAtm = (g: CanvasRenderingContext2D, key: string) => {
  const st = Number(key);
  g.fillStyle = "#121a3a"; g.fillRect(0, 0, 512, 384);
  g.textAlign = "center";
  if (st === 0) {
    g.fillStyle = "#cfc6ff"; g.font = "bold 34px sans-serif"; g.fillText("BALANCE", 256, 60);
    g.fillStyle = "#ffffff"; g.font = "bold 50px sans-serif"; g.fillText("2,000,000 PTC", 256, 120);
    g.fillStyle = st === 0 ? "#e5483d" : "#b33a31"; g.beginPath(); g.roundRect(76, 170, 360, 150, 26); g.fill();
    g.fillStyle = "#ffffff"; g.font = "bold 66px sans-serif"; g.fillText("SELL ALL", 256, 268);
  } else {
    g.fillStyle = "#7dff9a"; g.font = "bold 64px sans-serif"; g.fillText("SOLD!", 256, 100);
    g.fillStyle = "#ffd447"; g.font = "bold 62px sans-serif"; g.fillText("$4,000,000.00", 256, 200);
    g.fillStyle = "#ffffff"; g.font = "bold 38px sans-serif"; g.fillText("DISPENSING CASH...", 256, 296);
  }
};
/** register display: SMALL COFFEE ... -> TOTAL $4,000,000.00 */
const drawRegister = (g: CanvasRenderingContext2D, key: string) => {
  const st = Number(key);
  g.fillStyle = "#0e1b16"; g.fillRect(0, 0, 512, 320);
  g.textAlign = "center";
  g.fillStyle = "#9fffc8"; g.font = "bold 36px monospace"; g.fillText("1x SMALL COFFEE", 256, 74);
  g.fillStyle = "#9fffc8"; g.font = "bold 40px monospace"; g.fillText("TOTAL:", 256, 150);
  if (st === 0) { g.fillStyle = "#ffffff"; g.font = "bold 70px monospace"; g.fillText("...", 256, 250); }
  else { g.fillStyle = "#ffd447"; g.font = "bold 50px monospace"; g.fillText("$4,000,000.00", 256, 248); g.fillStyle = "#ff8a7a"; g.font = "bold 26px monospace"; g.fillText("(TIP NOT INCLUDED)", 256, 296); }
};

// ---------------- props ----------------
const brickGeo = new THREE.BoxGeometry(0.26, 0.1, 0.15);
const bandGeo = new THREE.BoxGeometry(0.06, 0.104, 0.154);
const makeBrick = () => {
  const g = new THREE.Group();
  const b = new THREE.Mesh(brickGeo, col("tf_cash", "#79bf6b")); b.castShadow = true; b.receiveShadow = true;
  const band = new THREE.Mesh(bandGeo, col("tf_band", "#f4efe3"));
  g.add(b, band);
  return g;
};
/** a stack of n bricks centred on its base, for hugging / carrying */
const makeStack = (n: number) => {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const b = makeBrick(); b.position.set((i % 2 ? 0.012 : -0.01), 0.05 + i * 0.1, 0); b.rotation.y = (hash(i + n) - 0.5) * 0.25; g.add(b); }
  return g;
};
const makeCup = () => {
  const g = new THREE.Group();
  g.add(cyl(0.04, 0.032, 0.09, col("tf_cup", "#fbf7ef"), 0, 0.045, 0, 14));
  g.add(cyl(0.042, 0.042, 0.03, col("tf_sleeve", "#8a5a3a"), 0, 0.045, 0, 14));
  g.add(cyl(0.043, 0.043, 0.014, col("tf_lid", "#3a2318"), 0, 0.096, 0, 14));
  return g;
};
const makePhone = (screen: THREE.Texture) => {
  const g = new THREE.Group();
  g.add(box(0.125, 0.245, 0.014, col("tf_phone_body", "#202228"), 0, 0, 0));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.23), new THREE.MeshBasicMaterial({ map: screen }));
  scr.position.z = 0.008; scr.layers.set(NOINK);
  g.add(scr);
  return g;
};
/** sleek hover car facing +z; optional roof TAXI sign */
const makeHoverCar = (hex: string, taxi = false) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), col("tf_hcar_" + hex, hex));
  body.scale.set(0.95, 0.42, 2.0); body.castShadow = true; g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), col("tf_hcar_glass", "#8fd8ff"));
  dome.scale.set(1, 0.85, 1.6); dome.position.set(0, 0.22, -0.15); g.add(dome);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.06), glow(2.2, 0.35, 0.4)); tail.position.set(0, 0.05, -1.98); tail.layers.set(NOINK); g.add(tail);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), glow(0.6, 1.6, 2.2));
  under.scale.set(1, 1, 2.2); under.position.y = -0.4; under.layers.set(NOINK); g.add(under);
  if (taxi) { const s = sign(0.5, 0.19, taxiTex(), "#241726", 0.04); s.g.position.set(0, 0.85, 0.05); s.g.rotation.y = Math.PI; g.add(s.g); const s2 = sign(0.5, 0.19, taxiTex(), "#241726", 0.04); s2.g.position.set(0, 0.85, 0.09); g.add(s2.g); }
  return g;
};
/** quad-rotor delivery drone with a pizza box slung underneath (faces +z) */
const makeDrone = () => {
  const g = new THREE.Group();
  const shell = col("tf_drone", "#e9edf3"), dark = col("tf_drone_dk", "#3a3f4a");
  g.add(box(0.5, 0.14, 0.5, shell, 0, 0, 0));
  const rotors: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
    g.add(box(0.5, 0.04, 0.06, dark, x / 2, 0.03, z / 2).rotateY(Math.atan2(x, z) + Math.PI / 2));
    g.add(cyl(0.035, 0.035, 0.08, dark, x, 0.08, z, 8));
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.05), dark); r.position.set(x, 0.13, z); rotors.push(r); g.add(r);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glow(0.4, 1.8, 2.4)); eye.position.set(0, 0, 0.26); eye.layers.set(NOINK); g.add(eye);
  g.add(box(0.02, 0.26, 0.02, dark, 0, -0.18, 0));
  const pz = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.62), new THREE.MeshBasicMaterial({ map: pizzaTex() }));
  pz.position.y = -0.36; pz.castShadow = true; g.add(pz);
  g.userData.rotors = rotors;
  return g;
};

// ---------------- robots ----------------
type BotPose = { pos: V3; yaw: number; t: number; face: BotFace; armL?: number; armR?: number; spreadL?: number; spreadR?: number; tilt?: number; lean?: number };
class Bot {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  handL = new THREE.Object3D();
  handR = new THREE.Object3D();
  private faceMat: THREE.MeshBasicMaterial;
  constructor(parent: THREE.Object3D, private kind: "nurse" | "barista", private eyeCol: string) {
    const shell = col("tf_bot_shell_" + kind, kind === "nurse" ? "#f4f6fa" : "#eef1f4");
    const trim = col("tf_bot_trim_" + kind, kind === "nurse" ? "#7fd0e8" : "#7a4a32");
    this.root.add(this.body);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 22), glow(0.5, 1.7, 2.3));
    base.position.y = 0.3; base.layers.set(NOINK); this.body.add(base);
    const torso = ball(1, shell, 0, 0.76, 0); torso.scale.set(0.3, 0.42, 0.27); this.body.add(torso);
    this.body.add(cyl(0.29, 0.29, 0.07, trim, 0, 0.82, 0, 24));
    this.body.add(cyl(0.06, 0.07, 0.14, col("tf_bot_neck", "#9aa3b2"), 0, 1.2, 0, 12));
    if (kind === "nurse") {
      const red = col("tf_bot_cross", "#e5483d");
      this.body.add(box(0.13, 0.04, 0.03, red, 0, 0.98, 0.235), box(0.04, 0.13, 0.03, red, 0, 0.98, 0.235));
    } else {
      this.body.add(box(0.36, 0.42, 0.03, col("tf_apron", "#7a4a32"), 0, 0.64, 0.255));
      const bow = col("tf_bowtie", "#241726");
      const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), bow); b1.rotation.z = Math.PI / 2; b1.position.set(0.045, 1.12, 0.2);
      const b2 = b1.clone(); b2.rotation.z = -Math.PI / 2; b2.position.x = -0.045;
      this.body.add(b1, b2);
    }
    // head with a screen face
    this.head.position.y = 1.44; this.body.add(this.head);
    this.head.add(box(0.48, 0.34, 0.32, shell, 0, 0, 0));
    this.head.add(box(0.06, 0.16, 0.16, trim, -0.26, 0, 0), box(0.06, 0.16, 0.16, trim, 0.26, 0, 0));
    this.faceMat = new THREE.MeshBasicMaterial({ map: botFaceTex("eyes", eyeCol) });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), this.faceMat);
    face.position.z = 0.162; face.layers.set(NOINK); this.head.add(face);
    this.head.add(cyl(0.01, 0.01, 0.16, col("tf_bot_neck", "#9aa3b2"), 0, 0.24, 0, 6));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow(2.2, 0.5, 0.45)); tip.position.y = 0.33; tip.layers.set(NOINK); this.head.add(tip);
    if (kind === "nurse") {
      const cap = box(0.3, 0.09, 0.16, col("tf_nurse_cap", "#ffffff"), 0, 0.21, 0.04);
      this.head.add(cap, box(0.05, 0.05, 0.01, col("tf_bot_cross", "#e5483d"), 0, 0.21, 0.125));
    }
    // arms: pivot at the shoulder, hanging down -y; rotation.x < 0 raises forward
    for (const [arm, hand, sx] of [[this.armL, this.handL, -1], [this.armR, this.handR, 1]] as [THREE.Group, THREE.Object3D, number][]) {
      arm.position.set(0.3 * sx, 1.0, 0);
      arm.add(ball(0.06, trim, 0, 0, 0));
      arm.add(cyl(0.035, 0.035, 0.36, col("tf_bot_neck", "#9aa3b2"), 0, -0.2, 0, 10));
      arm.add(ball(0.065, shell, 0, -0.42, 0));
      hand.position.set(0, -0.44, 0.02); arm.add(hand);
      this.body.add(arm);
    }
    parent.add(this.root);
  }
  pose(p: BotPose) {
    this.root.visible = true;
    this.root.position.set(p.pos[0], p.pos[1] + 0.03 * Math.sin(p.t * 2.6), p.pos[2]);
    this.root.rotation.set(0, p.yaw, 0);
    this.body.rotation.set(p.lean ?? 0, 0, 0.02 * Math.sin(p.t * 1.9));
    this.head.rotation.set(0, 0, p.tilt ?? 0);
    this.armL.rotation.set(-(p.armL ?? 0.15), 0, -(p.spreadL ?? 0.12));
    this.armR.rotation.set(-(p.armR ?? 0.15), 0, p.spreadR ?? 0.12);
    this.faceMat.map = botFaceTex(p.face, this.eyeCol);
    this.root.updateMatrixWorld(true);
  }
  hand(side: "L" | "R", out: THREE.Vector3) { return (side === "L" ? this.handL : this.handR).getWorldPosition(out); }
}

// ---------------- cast helpers ----------------
/** Gait: feet swing forward/back with lift, body bobs. hz = steps per second (each foot) */
const gait = (t: number, hz: number, ph: number, stride = 0.15, lift = 0.06) => {
  const w = 2 * Math.PI * hz * t + ph, s = Math.sin(w);
  return {
    s,
    footL: [-0.12, 0.04 + lift * Math.max(0, s), 0.05 + stride * s] as V3,
    footR: [0.12, 0.04 + lift * Math.max(0, -s), 0.05 - stride * s] as V3,
    bob: 0.022 * Math.abs(Math.cos(w)),
  };
};
const PED_JACKET = ["#ff6b9a", "#5dd1ff", "#ffd447", "#9f7bff", "#3fc28a", "#ff8a3d", "#f4f6fa", "#2d3a66", "#e5483d", "#7ee3d0", "#c06bff", "#4a8cff"];
const PED_HAIR = ["#ff7ad9", "#2a1d18", "#4fd6ff", "#e8e2d0", "#5a3b2a", "#9f7bff", "#1f1f1f", "#f0a030"];
const PED_SKIN = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067", "#a8714a"];

export class MultiSetWorld {
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

  // cast
  private hero: HeroRig25D;      // 2036: gown + knee-length beard
  private heroPast: HeroRig25D;  // 2026: hoodie, clean-shaven
  private beard: THREE.Group;
  private nurse: Bot;
  private barista: Bot;
  private peds: HeroRig25D[] = [];
  // props
  private ivLine: THREE.Mesh;
  private ivBag = new THREE.Vector3(-0.72, 1.62, 2.1);
  private phone: THREE.Group;
  private phoneScreen = new LiveTex(512, 1024, drawPhone);
  private laptopScreen = new LiveTex(1024, 640, drawLaptop);
  private atmScreen = new LiveTex(512, 384, drawAtm);
  private registerScreen = new LiveTex(512, 320, drawRegister);
  private billboard: THREE.MeshBasicMaterial;
  private cars: { g: THREE.Group; lane: number }[] = [];
  private taxi: THREE.Group;
  private drones: THREE.Group[] = [];
  private pileBricks: THREE.Group[] = [];
  private heroStack: THREE.Group;
  private pedStacks: THREE.Group[] = [];
  private cup: THREE.Group;
  private lampGlow: THREE.MeshBasicMaterial;

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
    for (const name of ["hospital", "apartment", "city"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }
    this.lampGlow = glow(2.4, 1.9, 1.2);
    this.billboard = new THREE.MeshBasicMaterial({ map: billboardTex(false) });

    this.buildHospital();
    this.buildApartment();
    this.buildCity();

    // ---- cast ----
    this.hero = new HeroRig25D(R, { jacket: "#a9d3e6", stripes: "#8ec2da", hair: "#6b4a32", beard: "#6b4a32", seed: 3 });
    this.heroPast = new HeroRig25D(R, { jacket: "#3d5a80", hair: "#6b4a32", seed: 4 });
    this.beard = this.makeBeard("#6b4a32");
    this.hero.headPivot.add(this.beard);
    this.nurse = new Bot(R, "nurse", "#5fe3ff");
    this.barista = new Bot(R, "barista", "#ffd36b");
    for (let k = 0; k < 12; k++) {
      const st: RigStyle = { jacket: PED_JACKET[k], hair: PED_HAIR[(k * 3) % PED_HAIR.length], skin: PED_SKIN[(k * 2) % PED_SKIN.length], shades: k % 3 === 0, seed: 50 + k };
      this.peds.push(new HeroRig25D(R, st));
      const s = makeStack(3); this.pedStacks.push(s); R.add(s);
    }

    // ---- props ----
    this.ivLine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), col("tf_iv_line", "#dfe8ee"));
    this.ivLine.layers.set(NOINK);
    R.add(this.ivLine);
    this.phone = makePhone(this.phoneScreen.tex); R.add(this.phone);
    this.heroStack = makeStack(6); R.add(this.heroStack);
    this.cup = makeCup(); R.add(this.cup);
    for (let i = 0; i < 26; i++) { const b = makeBrick(); this.pileBricks.push(b); R.add(b); }
    const hex = ["#ff5d73", "#5dd1ff", "#9f7bff", "#ffd447", "#3fc28a", "#f4f6fa", "#ff8a3d", "#e5483d", "#4a8cff", "#ffd447", "#7ee3d0", "#c06bff", "#ffd447", "#ff6b9a"];
    for (let i = 0; i < 14; i++) { const g = makeHoverCar(hex[i], hex[i] === "#ffd447"); this.cars.push({ g, lane: i }); R.add(g); }
    this.taxi = makeHoverCar("#ffd447", true); R.add(this.taxi);
    for (let i = 0; i < 5; i++) { const d = makeDrone(); this.drones.push(d); R.add(d); }
  }

  private makeBeard(hex: string) {
    const g = new THREE.Group();
    // LatheGeometry winds outward only for profiles listed bottom -> top
    const prof = [[0.0, -0.74], [0.05, -0.7], [0.09, -0.58], [0.125, -0.42], [0.15, -0.24], [0.155, -0.08], [0.125, 0.0], [0.0, 0.02]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(prof, 20);
    const mat = cardShade(new THREE.MeshLambertMaterial({ map: beardTex(hex) }));
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(1, 1, 0.45); m.layers.set(NOINK);
    const hull = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#241726", side: THREE.BackSide }));
    hull.scale.setScalar(1.06); hull.layers.set(NOINK); m.add(hull);
    g.add(m);
    g.position.set(0, 0.1, 0.16);
    g.rotation.x = -0.2;
    return g;
  }

  // ======================= SETS =======================
  private room(S: THREE.Group, wallBack: string, wallSide: string, floorHex: string, key: string) {
    S.add(box(5.4, 0.1, 4.6, col(key + "_floor", floorHex), 0, -0.05, 0.55, false));
    S.add(box(5.4, 2.8, 0.1, col(key + "_wb", wallBack), 0, 1.4, 2.65, false), box(0.1, 2.8, 4.6, col(key + "_ws", wallSide), -2.65, 1.4, 0.55, false), box(0.1, 2.8, 4.6, col(key + "_ws", wallSide), 2.65, 1.4, 0.55, false));
    S.add(box(5.4, 0.12, 0.05, col("tf_skirting", "#f2ede2"), 0, 0.06, 2.59, false));
    S.add(box(30, 0.05, 30, col("tf_out_ground", "#5f6670"), 0, -0.14, 0, false));
  }

  private buildHospital() {
    // Room x -2.6..2.6, z -1.5..2.6, back wall z = 2.6; the bed head sits against the back wall on the left
    const S = this.sets.hospital;
    this.room(S, "#cfe8df", "#dcefe8", "#c9ccd2", "tf_hosp");
    const metal = col("tf_metal", "#b8c0cc");
    S.add(box(1.5, 0.3, 2.2, col("tf_bedbase", "#e8ecf2"), -1.75, 0.25, 1.35), box(1.5, 1.0, 0.1, col("tf_bedhead", "#9fb8d0"), -1.75, 0.5, 2.52));
    for (const z of [0.3, 2.4]) for (const x of [-2.4, -1.1]) S.add(cyl(0.03, 0.03, 0.12, metal, x, 0.06, z, 8));
    S.add(box(1.42, 0.16, 2.1, col("tf_mattress", "#f6f6f2"), -1.75, 0.47, 1.38));
    S.add(box(0.9, 0.14, 0.42, col("tf_pillow", "#ffffff"), -1.75, 0.62, 2.18));
    S.add(box(1.48, 0.2, 1.75, col("tf_hosp_blanket", "#8ec2da"), -1.75, 0.66, 1.12));
    S.add(box(0.04, 0.22, 1.2, metal, -0.98, 0.72, 1.6)); // bed rail
    // wall screen above the bed: the year
    const cal = sign(1.1, 0.55, calendarTex(), "#2a3442", 0.05);
    cal.g.rotation.y = Math.PI; cal.g.position.set(-1.75, 2.05, 2.58); S.add(cal.g);
    // heart monitor on an arm
    const mon = sign(0.42, 0.32, monitorTex(), "#3a3f4a", 0.08);
    mon.g.rotation.y = Math.PI - 0.35; mon.g.position.set(-0.55, 1.5, 2.45); S.add(mon.g);
    S.add(box(0.06, 0.06, 0.3, metal, -0.6, 1.5, 2.6));
    // IV stand (bag hangs at ivBag)
    S.add(cyl(0.02, 0.02, 1.85, metal, -0.72, 0.93, 2.1, 8), cyl(0.2, 0.2, 0.03, metal, -0.72, 0.03, 2.1, 12));
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 6, 10), col("tf_ivbag", "#cfeaf5")); bag.scale.z = 0.5;
    bag.position.set(-0.72, 1.75, 2.1); S.add(bag);
    // window (future skyline + flying cars), door, potted plant, side table with flowers
    const win = sign(1.2, 1.05, hospWindowTex(), "#f2ede2", 0.05);
    win.g.rotation.y = Math.PI; win.g.position.set(1.0, 1.55, 2.58); S.add(win.g);
    S.add(box(1.32, 0.08, 0.12, col("tf_trim", "#f2ede2"), 1.0, 1.0, 2.55), box(0.05, 1.05, 0.06, col("tf_trim", "#f2ede2"), 1.0, 1.55, 2.56));
    S.add(box(0.06, 2.05, 0.95, col("tf_hdoor", "#e9e2d2"), 2.6, 1.03, 0.65));
    S.add(box(0.46, 0.55, 0.42, col("tf_sidetable", "#c9b28a"), 0.0, 0.275, 2.25));
    S.add(cyl(0.07, 0.06, 0.2, col("tf_vase", "#5f9ec9"), 0.0, 0.65, 2.25, 12));
    for (let i = 0; i < 5; i++) S.add(ball(0.05, col("tf_flower_" + (i % 3), ["#ff6b9a", "#ffd447", "#ff8a3d"][i % 3]), Math.cos(i * 1.3) * 0.07, 0.82 + (i % 2) * 0.04, 2.25 + Math.sin(i * 1.3) * 0.07));
    // ten years of dust: a cobweb-y "get well soon" balloon, deflated, drooping on a string
    const bl = ball(0.13, col("tf_balloon", "#d0b8e8"), 0.12, 1.02, 2.3); bl.scale.set(1, 0.6, 1); S.add(bl);
  }

  private buildApartment() {
    // 2026 flashback: a tiny room at night, you at the desk facing -z; the back wall (z = 2.6) carries window + poster
    const S = this.sets.apartment;
    this.room(S, "#3b4a6e", "#34405f", "#6e5440", "tf_apt");
    const wood = col("tf_desk", "#8a6040");
    S.add(box(1.5, 0.05, 0.7, wood, 0, 0.74, 1.0), box(0.05, 0.72, 0.65, wood, -0.7, 0.36, 1.0), box(0.05, 0.72, 0.65, wood, 0.7, 0.36, 1.0));
    // chair behind you
    S.add(box(0.5, 0.06, 0.5, col("tf_chair", "#2d3142"), 0, 0.47, 1.7), box(0.5, 0.6, 0.06, col("tf_chair", "#2d3142"), 0, 0.8, 1.97));
    S.add(cyl(0.03, 0.03, 0.45, col("tf_metal", "#b8c0cc"), 0, 0.22, 1.7, 8));
    // laptop: base on the desk, screen facing +z (toward you)
    S.add(box(0.48, 0.02, 0.32, col("tf_laptop", "#c3c8d2"), 0, 0.775, 1.14));
    const lid = new THREE.Group(); lid.position.set(0, 0.785, 0.99); lid.rotation.x = -0.22;
    lid.add(box(0.48, 0.32, 0.015, col("tf_laptop", "#c3c8d2"), 0, 0.16, -0.008));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), new THREE.MeshBasicMaterial({ map: this.laptopScreen.tex }));
    scr.position.set(0, 0.16, 0.001); scr.layers.set(NOINK); lid.add(scr);
    S.add(lid);
    // desk lamp (warm glow), energy drinks, pizza box
    S.add(cyl(0.08, 0.1, 0.03, col("tf_lamp", "#e5483d"), -0.55, 0.78, 0.85, 12), cyl(0.012, 0.012, 0.42, col("tf_lamp", "#e5483d"), -0.55, 0.99, 0.85, 6));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 16, 1, true), col("tf_lamp", "#e5483d")); shade.position.set(-0.5, 1.2, 0.9); shade.rotation.z = -0.5; S.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this.lampGlow); bulb.position.set(-0.49, 1.15, 0.9); bulb.layers.set(NOINK); S.add(bulb);
    for (let i = 0; i < 3; i++) S.add(cyl(0.033, 0.033, 0.12, col("tf_can_" + i, ["#3fc28a", "#5dd1ff", "#ff6b9a"][i]), 0.45 + i * 0.08, 0.83, 0.82 + (i % 2) * 0.1, 10));
    const pz = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), new THREE.MeshBasicMaterial({ map: pizzaTex() })); pz.position.set(1.4, 0.03, 0.4); S.add(pz);
    const win = sign(1.2, 1.05, nightWindowTex(), "#c9c2b0", 0.05);
    win.g.rotation.y = Math.PI; win.g.position.set(-1.2, 1.6, 2.58); S.add(win.g);
    const post = sign(0.5, 0.7, posterTex(), "#1b2350", 0.01);
    post.g.rotation.y = Math.PI; post.g.position.set(0.9, 1.6, 2.58); S.add(post.g);
    S.add(box(1.4, 0.4, 2.0, col("tf_apt_bed", "#5a4a7a"), 1.8, 0.2, -0.2));
  }

  private buildCity() {
    // Road along z (x -5..5), raised sidewalks (top y = 0.15) out to |x| = 10, tower fronts at |x| = 10.
    // ATM at the right-hand building front (z = 30), Future Beans kiosk at z 43.8..47.2, skybridge billboard at z = 62.
    const S = this.sets.city;
    const asphalt = twoTone(new THREE.MeshPhongMaterial({ color: "#4a5262", specular: "#6f788a", shininess: 30 }));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 340), asphalt);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 80); road.receiveShadow = true; S.add(road);
    for (let i = 0; i < 40; i++) S.add(box(0.14, 0.01, 3.0, glow(0.45, 1.25, 1.5), 0, 0.006, -60 + i * 8, false));
    for (const sx of [-1, 1]) {
      S.add(box(5, 0.15, 340, col("tf_walk", "#d8d4cc"), sx * 7.5, 0.075, 80, false));
      S.add(box(0.12, 0.155, 340, col("tf_curb_glow", "#9fe8ff"), sx * 5.06, 0.078, 80, false));
      S.add(box(60, 0.04, 340, col("tf_far_ground", "#9aa6b8"), sx * 50, 0.0, 80, false));
    }
    // towers (pastel, glowing window bands, domed / spired tops)
    const walls = ["#e8e2f8", "#cfe6f5", "#f5e6cf", "#d4f0e4", "#f0d6e8", "#dfe3ea"];
    const band = glow(0.62, 1.05, 1.25);
    for (let i = 0; i < 22; i++) {
      for (const sx of [-1, 1]) {
        const z = -70 + i * 15, h = 16 + hash(i * 3.1 + sx) * 42, k = (i * 2 + (sx > 0 ? 1 : 0)) % walls.length;
        const t = new THREE.Group(); t.position.set(sx * 17, 0, z);
        t.add(box(14, h, 13.6, col("tf_tower_" + k, walls[k]), 0, h / 2, 0));
        for (let y = 4.2; y < h - 1; y += 3.4) t.add(box(0.06, 0.55, 12.4, band, -sx * 7.02, y, 0, false));
        t.add(box(0.3, 3.3, 13.8, col("tf_tower_base", "#6b7690"), -sx * 7.0, 1.65, 0, false));
        if (hash(i + sx * 7) > 0.5) { const d = new THREE.Mesh(new THREE.SphereGeometry(5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), col("tf_dome", "#a8d8ff")); d.position.y = h; t.add(d); }
        else { t.add(cyl(0.25, 0.6, 7, col("tf_spire", "#9aa3b2"), 0, h + 3.5, 0, 10)); }
        S.add(t);
      }
    }
    // street-level storefront glass on the right (behind ATM / kiosk)
    S.add(box(0.06, 2.6, 28, glow(0.35, 0.55, 0.7), 9.84, 1.45, 38, false));
    // skybridge billboard over the street
    S.add(box(10.4, 0.8, 2.2, col("tf_bridge", "#dfe3ea"), 0, 6.3, 62));
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), this.billboard);
    bb.position.set(0, 8.9, 60.88); bb.rotation.y = Math.PI; bb.layers.set(NOINK); S.add(bb);
    S.add(box(12.3, 4.3, 0.2, col("tf_bb_back", "#241726"), 0, 8.9, 61.0));
    S.add(box(0.3, 3, 0.3, col("tf_bb_back", "#241726"), -4.5, 8.0, 61.4), box(0.3, 3, 0.3, col("tf_bb_back", "#241726"), 4.5, 8.0, 61.4));
    // side ads (foreshadowing the prices)
    const adR = sign(3.2, 4.8, sideAdTex("taxi", "FLYING|TAXI", "1 RIDE|$850,000", "#2d3a66"), "#241726", 0.1);
    adR.g.rotation.y = -Math.PI / 2; adR.g.position.set(9.9, 7.5, 20); S.add(adR.g);
    const adL = sign(3.2, 4.8, sideAdTex("pizza", "HOLO|PIZZA", "ONLY|$1.2 MILLION", "#7a1f3d"), "#241726", 0.1);
    adL.g.rotation.y = Math.PI / 2; adL.g.position.set(-9.9, 7.5, 40); S.add(adL.g);
    // futuristic lamps + planters
    for (let z = -20; z < 140; z += 16) for (const sx of [-1, 1]) {
      if (sx > 0 && z + 8 === 20) continue; // shot 15's tracking camera runs along x = 5.6 and would drive through this pole
      S.add(cyl(0.07, 0.09, 4.6, col("tf_pole", "#3a3f4a"), sx * 5.6, 2.45, z + (sx > 0 ? 8 : 0), 10));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 20), glow(0.7, 1.6, 2.0)); ring.rotation.x = Math.PI / 2;
      ring.position.set(sx * 5.6, 4.8, z + (sx > 0 ? 8 : 0)); ring.layers.set(NOINK); S.add(ring);
    }
    for (const [x, z] of [[-8.2, 12], [-8.2, 34], [-8.2, 56], [8.9, 10], [8.9, 58]]) {
      S.add(box(1.0, 0.5, 1.0, col("tf_planter", "#9aa3b2"), x, 0.4, z));
      const tr = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), col("tf_leaf", "#4fbf7a")); tr.position.set(x, 1.5, z); tr.castShadow = true; S.add(tr);
    }
    // ---- PotatoCoin ATM (front face -x at x = 9.3) ----
    const atm = new THREE.Group(); atm.position.set(9.62, 0.15, 30);
    atm.add(box(0.64, 1.95, 0.95, col("tf_atm", "#2d3a66"), 0, 0.975, 0));
    atm.add(box(0.2, 0.08, 0.7, col("tf_atm_lip", "#1a1340"), -0.38, 0.86, 0));
    const atmScr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.465), new THREE.MeshBasicMaterial({ map: this.atmScreen.tex }));
    atmScr.position.set(-0.325, 1.2, 0); atmScr.rotation.y = -Math.PI / 2; atmScr.layers.set(NOINK); atm.add(atmScr);
    atm.add(box(0.04, 0.06, 0.4, glow(0.3, 0.3, 0.35), -0.33, 0.8, 0));
    const atmSign = sign(0.9, 0.28, atmSignTex(), "#1a1340", 0.04); atmSign.g.rotation.y = -Math.PI / 2; atmSign.g.position.set(-0.34, 1.78, 0); atm.add(atmSign.g);
    S.add(atm);
    // ---- Future Beans kiosk ----
    const K = new THREE.Group();
    K.add(box(0.5, 1.05, 3.4, col("tf_counter", "#f6e7cf"), 9.1, 0.15 + 0.525, 45.5));
    K.add(box(0.52, 0.16, 3.42, col("tf_counter_band", "#7a4a32"), 9.1, 0.15 + 0.7, 45.5, false));
    K.add(box(0.56, 0.05, 3.5, col("tf_counter_top", "#3a2318"), 9.1, 1.225, 45.5));
    for (let i = 0; i < 6; i++) K.add(box(1.3, 0.08, 0.58, col("tf_awning_" + (i % 2), i % 2 ? "#f6e7cf" : "#7a4a32"), 9.35, 2.95, 43.8 + i * 0.58));
    const ks = sign(2.9, 0.68, kioskSignTex(), "#3a2318", 0.06); ks.g.rotation.y = -Math.PI / 2; ks.g.position.set(9.6, 3.45, 45.5); K.add(ks.g);
    const menu = sign(1.3, 0.975, menuTex(), "#1d2a26", 0.05); menu.g.rotation.y = -Math.PI / 2; menu.g.position.set(9.8, 2.35, 46.75); K.add(menu.g);
    K.add(cyl(0.16, 0.16, 0.4, col("tf_machine", "#b8c0cc"), 9.35, 1.45, 44.4, 14));
    // register with a live display facing you (-x)
    K.add(box(0.2, 0.12, 0.34, col("tf_register", "#3a3f4a"), 9.15, 1.31, 46.42));
    const reg = new THREE.Group(); reg.position.set(9.06, 1.4, 46.42); reg.rotation.set(0, -Math.PI / 2, 0);
    reg.add(box(0.38, 0.24, 0.03, col("tf_register", "#3a3f4a"), 0, 0, -0.02));
    const regScr = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ map: this.registerScreen.tex }));
    regScr.position.z = 0.0; regScr.layers.set(NOINK); reg.add(regScr); reg.rotateX(-0.18);
    K.add(reg);
    // raised platform the barista hovers above
    K.add(box(1.0, 0.1, 3.4, col("tf_kiosk_floor", "#6b7690"), 9.55, 0.2, 45.5, false));
    S.add(K);
  }

  // ======================= LIGHT RIG =======================
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

  private attach(rig: HeroRig25D, side: "L" | "R", obj: THREE.Object3D, yaw: number, pitch: number, roll = 0) {
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
  private rod(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    const d = this.tmpV2.copy(b).sub(a);
    const L = d.length();
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.scale.set(1, L, 1);
    m.visible = true;
  }

  // ======================= PER-SHOT POSES =======================
  /** beard sway: hanging (k = 0) or streaming back over the shoulder while sprinting (k = 1) */
  private beardPose(t: number, k: number) {
    this.beard.rotation.set(-0.2 + k * (1.05 + 0.18 * Math.sin(t * 15)), 0, 0.04 * Math.sin(t * 2.1) + k * 0.16 * Math.sin(t * 11));
  }

  private poseHospital(id: number, f: number, t: number) {
    const base: RigPose = { pos: [-1.75, -0.12, 1.55], yaw: Math.PI, lean: 0.06, armsFollowLean: true,
      handL: [-0.24, 0.84, 0.34], handR: [0.24, 0.84, 0.34], footL: [-0.12, 0.66, 0.85], footR: [0.12, 0.66, 0.85] };
    let p: RigPose = { ...base };
    if (id === 1 || id === 2) {
      // eyes snap open (f6), bolt upright (f8-16, overshoot)
      const up = f < 7 ? 0 : Math.min(1.08, 1.08 * smooth((f - 7) / 8)) - 0.08 * smooth((f - 15) / 6);
      const look = id === 2 ? 0.35 * Math.sin((f - 56) * 0.09) : 0;
      p = { ...base, lean: lerp(-1.32, 0.06, up), expr: f < 6 ? "neutral" : id === 2 && f > 80 ? "nervous" : "shock", blink: f < 6 ? 1 : 0,
        headPitch: f < 6 ? -0.3 : -0.04, headYaw: look, mouthOpen: id === 1 && f > 8 ? 0.4 : 0,
        handL: [-0.26, lerp(0.74, 0.86, up), 0.3], handR: [0.26, lerp(0.74, 0.86, up), 0.3] };
    } else if (id === 3) {
      // look down at the beard, lift the tip
      const k = smooth((f - 130) / 16);
      p = { ...base, expr: "shock", headPitch: 0.32 * k, handR: [lerp(0.24, 0.06, k), lerp(0.84, 0.62, k), lerp(0.34, 0.42, k)] };
    } else if (id === 4 || id === 5 || id === 6) {
      // nurse-bot holds your left wrist; you stare at it
      const sh = id === 6 ? smooth((f - 312) / 6) : 0;
      p = { ...base, expr: id === 4 ? "nervous" : "shock", headYaw: -0.75 + 0.15 * sh, headPitch: -0.05 - 0.06 * sh,
        mouthOpen: id === 6 ? 0.25 + 0.5 * sh : 0, handL: [-0.36, 0.98, 0.3] };
    } else if (id === 11 || id === 12) {
      // phone in both hands; on "four million" (f843) your jaw drops
      const drop = id === 12 ? smooth((f - 845) / 5) : 0;
      p = { ...base, expr: id === 12 ? "shock" : "neutral", headPitch: id === 11 ? 0.4 : 0.05, mouthOpen: 0.9 * drop,
        handL: [-0.06, 1.07, 0.43], handR: [0.06, 1.07, 0.43] };
      if (id === 12) { p.handL = [-0.08, lerp(1.07, 0.95, drop), 0.4]; p.handR = [0.08, lerp(1.07, 0.95, drop), 0.4]; }
    } else if (id === 13) {
      // grab the IV (f878-897), yank (f899), leap out of bed (f903+)
      const grab = smooth((f - 874) / 12), yank = smooth((f - 899) / 4), leap = smooth((f - 903) / 9);
      p = { ...base, expr: f < 899 ? "stern" : "grin", mouthOpen: f >= 899 ? 0.5 : 0,
        handL: [-0.3, 0.92, 0.3],
        handR: f < 899 ? [lerp(0.24, -0.22, grab), lerp(0.84, 0.95, grab), lerp(0.34, 0.36, grab)] : [lerp(-0.22, 0.5, yank), lerp(0.95, 1.5, yank), 0.25] };
      if (f >= 903) {
        p.pos = [lerp(-1.75, -0.95, leap), lerp(-0.12, 0.1, leap) + 0.35 * Math.sin(Math.PI * leap), lerp(1.55, 0.7, leap)];
        p.yaw = Math.PI - 0.7 * leap; p.lean = lerp(0.06, 0.35, leap); p.footL = [-0.12, lerp(0.66, 0.1, leap), lerp(0.85, 0.1, leap)]; p.footR = [0.12, lerp(0.66, 0.25, leap), lerp(0.85, 0.2, leap)];
      }
    }
    this.hero.pose(p);
    this.beardPose(t, id === 13 ? 0.4 * smooth((f - 903) / 9) : 0); // sweep back with the leap, not a step
    // IV line from the bag to your left wrist (until you rip it out)
    if (!(id === 13 && f >= 899)) { this.hero.handWorld("L", this.tmpV); this.rod(this.ivLine, this.ivBag, this.tmpV.clone()); }
    // phone (Shot 11 insert / Shot 12)
    if (id === 11 || id === 12) {
      this.holdBetween(this.hero, this.phone, Math.PI, 0.02, 0.0);
      this.phone.rotation.set(id === 11 ? -0.8 : -0.3, 0, 0, "YXZ");
      const stage = f < 746 ? 0 : f < 790 ? 1 : 2;
      const k = clamp((f - 792) / 46);
      const bal = stage < 2 ? 200 : Math.round(200 * Math.pow(20001, k * k * (3 - 2 * k)) * 100) / 100;
      this.phoneScreen.set(`${stage}|${k >= 1 ? 4000200 : bal}`);
    }
    // nurse-bot
    if (id >= 4 && id <= 6) {
      const k = smooth((f - 172) / 24);
      const pos: V3 = id === 4 ? [lerp(1.4, -0.72, k), 0.12, lerp(0.9, 1.45, k)] : [-0.72, 0.12, 1.45];
      const talking = (f >= 224 && f < 256) || (f >= 262 && f < 297) || (f >= 301 && f < 344);
      this.nurse.pose({ pos, yaw: -Math.PI / 2 + (id === 4 ? 0.4 * (1 - k) : 0), t, face: talking ? "talk" : (f % 70 < 4 ? "blink" : "eyes"),
        armR: id === 4 ? lerp(0.2, 1.15, smooth((f - 192) / 10)) : 1.15, spreadR: -0.25, armL: 0.25, tilt: talking ? 0.06 * Math.sin(t * 5) : 0.08 });
    }
  }

  private poseApartment(id: number, f: number, t: number) {
    // you, 2026, hunched over the laptop at 2 am; the screen lights your face
    const typing = id === 9 && f < 560;
    const tp = typing ? Math.sin(t * 22) : 0;
    const click = id === 10 && f >= 640 && f < 660;
    this.heroPast.pose({ pos: [0, -0.22, 1.62], yaw: Math.PI, lean: 0.18, expr: id === 10 && f >= 660 ? "grin" : "smile",
      headPitch: 0.12, blink: f % 95 < 3 ? 1 : 0,
      handL: [-0.12 - 0.02 * tp, 0.98, 0.46], handR: [0.13 + 0.02 * tp, 0.98 + (click ? -0.02 : 0), 0.46],
      footL: [-0.14, 0.26, 0.35], footR: [0.14, 0.26, 0.35] });
    // laptop cursor: drifts onto BUY (f600-648), click (f650-656), filled (f660+)
    const st = f < 650 ? 0 : f < 660 ? 1 : 2;
    const k = smooth((f - 600) / 48);
    this.laptopScreen.set(`${st}|${Math.round(lerp(820, 540, k))}|${Math.round(lerp(560, 470, k))}`);
    this.lampGlow.color.setRGB(2.4, 1.9, 1.2);
  }

  /** Flying traffic: lanes along z (over the road) and crossing lanes along x */
  private poseTraffic(t: number, golden: boolean) {
    for (const { g, lane } of this.cars) {
      const along = lane < 8;
      const sp = 9 + hash(lane * 3.3) * 7, dir = lane % 2 ? 1 : -1;
      const s = ((hash(lane * 1.7) * 220 + sp * t) % 220) - 60;
      if (along) {
        const x = [-2.4, 2.4, -1.0, 1.0, -3.2, 3.2, -0.2, 0.6][lane], y = lane < 4 ? 4.6 + (lane % 2) * 0.3 : 12.5 + (lane % 3) * 1.5;
        g.position.set(x, y + 0.12 * Math.sin(t * 2 + lane), dir > 0 ? s : 160 - s);
        g.rotation.set(0, dir > 0 ? 0 : Math.PI, 0.03 * Math.sin(t + lane));
      } else {
        const z = [24, 40, 52, 75, 90, 110][lane - 8], y = 11 + (lane % 3) * 2;
        g.position.set(dir > 0 ? s - 80 : 80 - s, y, z);
        g.rotation.set(0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      }
      g.visible = true;
    }
    this.drones.forEach((d, i) => {
      const a = t * (0.35 + 0.1 * i) + i * 1.9;
      d.position.set(Math.sin(a) * (3 + i), 6.5 + i * 1.6 + 0.2 * Math.sin(t * 3 + i), 20 + i * 12 + Math.cos(a) * 6);
      d.rotation.set(0, a + Math.PI / 2, 0);
      d.visible = !golden || i < 3;
      for (const r of d.userData.rotors as THREE.Mesh[]) r.rotation.y = t * 40 + i;
    });
  }

  private pedWalk(k: number, f: number, t: number, carry: boolean) {
    // two sidewalk streams; each pedestrian loops along z on its own lane
    const side = k % 2 ? 1 : -1, dir = (k >> 1) % 2 ? 1 : -1;
    const x = side * (6.4 + (k % 3) * 0.9);
    const z = 26 + ((hash(k * 4.1) * 50 + dir * (f / FPS) * 1.25 + 500) % 50);
    const g = gait(t, 0.95, k * 1.3, 0.14, 0.05);
    const rig = this.peds[k];
    rig.pose({ pos: [x, 0.15 + g.bob, z], yaw: dir > 0 ? 0 : Math.PI, lean: 0.04, expr: carry ? (k % 3 ? "grin" : "smile") : "smile",
      headYaw: 0.15 * Math.sin(t * 0.7 + k), footL: g.footL, footR: g.footR,
      handL: carry ? [-0.13, 0.98, 0.32] : [-0.24, 0.74, 0.12 + 0.12 * g.s], handR: carry ? [0.13, 0.98, 0.32] : [0.24, 0.74, 0.12 - 0.12 * g.s] });
    if (carry) this.holdBetween(rig, this.pedStacks[k], dir > 0 ? 0 : Math.PI, 0.03, -0.06);
  }

  private poseCity(id: number, f: number, t: number) {
    const golden = id >= 23;
    this.billboard.map = billboardTex(golden);
    this.poseTraffic(t, golden);
    // pizza drone at the lens (Shot 8)
    if (id === 8) { const d = this.drones[0]; d.position.set(...droneP(f)); d.rotation.set(0.08, Math.PI, 0); }
    // flying taxi swoop (Shot 15)
    if (id === 15) {
      const p = taxiSwoop(f), p2 = taxiSwoop(f + 1);
      this.taxi.position.set(...p); this.taxi.lookAt(p2[0], p2[1], p2[2]); this.taxi.visible = true;
    }
    // pedestrians
    if (id >= 14 && id !== 20 && id !== 22) {
      for (let k = 0; k < 12; k++) {
        if (!golden && k % 2 === 1 && (id === 14 || id === 15)) continue; // keep your sprint lane clear
        this.pedWalk(k, f, t, golden);
      }
    }
    // ---- you ----
    if (id === 14 || id === 15) {
      // gown + beard flapping sprint
      const g = gait(t, 2.5, 0, 0.32, 0.14);
      this.hero.pose({ pos: [7.0, 0.15 + 2 * g.bob, runZ(f)], yaw: 0, lean: 0.26, expr: "relief_open", mouthOpen: 0.5,
        headPitch: -0.12, footL: g.footL, footR: g.footR,
        handL: [-0.25, 0.98 + 0.1 * g.s, 0.12 - 0.3 * g.s], handR: [0.25, 0.98 - 0.1 * g.s, 0.12 + 0.3 * g.s] });
      this.beardPose(t, 1);
    } else if (id === 16) {
      const tap = smooth((f - 1080) / 8) * (1 - smooth((f - 1094) / 8)), tap2 = smooth((f - 1128) / 8) * (1 - smooth((f - 1140) / 8));
      const reach = Math.max(tap, tap2);
      this.hero.pose({ pos: [8.45, 0.15, 30.62], yaw: Math.PI / 2 - 0.35, lean: 0.06, expr: f > 1138 ? "relief_open" : "grin",
        mouthOpen: f > 1138 ? 0.5 : 0, headPitch: -0.05,
        handL: [-0.25, 0.8, 0.15], handR: [lerp(0.25, 0.12, reach), lerp(0.85, 1.3, reach), lerp(0.2, 0.62, reach)] });
      this.beardPose(t, 0);
    } else if (id === 17) {
      // bricks pour out (f1160-1200); you dive onto the pile and hug it (f1203+)
      const dive = smooth((f - 1200) / 8);
      if (f < 1200) {
        this.hero.pose({ pos: [8.3, 0.15, 30.75], yaw: Math.PI / 2 - 0.5, lean: -0.05, expr: "laugh", mouthOpen: 0.5,
          handL: [-0.42, 1.55 + 0.05 * Math.sin(t * 9), 0.1], handR: [0.42, 1.55 + 0.05 * Math.cos(t * 9), 0.1] });
      } else {
        this.hero.pose({ pos: [lerp(8.3, 8.55, dive), lerp(0.15, -0.33, dive), lerp(30.75, 30.45, dive)], yaw: Math.PI / 2 - 0.3, lean: lerp(-0.05, 0.45, dive),
          armsFollowLean: true, expr: f > 1210 ? "relief" : "laugh", blink: 0, headYaw: 0.2 * Math.sin(t * 3),
          handL: [-0.17, 0.82, 0.42], handR: [0.17, 0.82, 0.42], footL: [-0.14, 0.33, -0.25], footR: [0.14, 0.33, -0.25] });
        this.holdBetween(this.hero, this.heroStack, Math.PI / 2 - 0.3, 0.06, -0.3);
      }
      this.beardPose(t, 0);
      // bricks: arc out of the slot at (9.29, 0.95, 30), land in a pile
      this.pileBricks.forEach((b, i) => {
        const t0 = 1160 + i * 1.5, a = (f - t0) / 9;
        const px = 8.95 - (i % 4) * 0.13 - hash(i) * 0.12, pz = 29.75 + ((i >> 2) % 4) * 0.17 + hash(i * 3) * 0.08, py = 0.2 + Math.floor(i / 16) * 0.1 + (i % 3) * 0.05;
        if (a < 0) { b.visible = false; return; }
        const k = Math.min(1, a);
        b.position.set(lerp(9.25, px, k), lerp(0.97, py, k) + 0.35 * Math.sin(Math.PI * k), lerp(30, pz, k));
        b.rotation.set(k < 1 ? a * 3 : 0, hash(i) * 2, 0);
        b.visible = true;
      });
    } else if (id === 18) {
      // stroll up to the kiosk, hugging a stack of cash
      const k = smooth((f - 1256) / 70), g = gait(t, f < 1322 ? 1.0 : 0, 0, 0.14, 0.05);
      const p: V3 = [lerp(7.3, HERO_KIOSK[0], k), 0.15 + g.bob, lerp(38.5, HERO_KIOSK[2], k)];
      this.hero.pose({ pos: p, yaw: lerp(0.15, Math.PI / 2, smooth((f - 1300) / 30)), lean: 0.02, expr: "grin", footL: g.footL, footR: g.footR,
        handL: [-0.15, 0.95, 0.3], handR: [0.15, 0.95, 0.3] });
      this.holdBetween(this.hero, this.heroStack, this.hero.root.rotation.y, 0.04, -0.12);
      this.beardPose(t, 0);
    } else if (id >= 19 && id <= 22) {
      const laugh = id === 21 && f >= 1510;
      const shock = (id === 21 && f < 1510) || id === 20;
      // the stack slides from your hands onto the counter as you order (f1389-1397); the laugh tips your head back over 6 frames
      const place = smooth((f - 1389) / 8), lk = id === 21 ? smooth((f - 1507) / 6) : 0;
      const mix = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      const handR = mix(mix([0.15, 0.95, 0.3], [0.24, 0.8, 0.18], place), [0.2, 1.0, 0.35], lk);
      this.hero.pose({ pos: HERO_KIOSK, yaw: Math.PI / 2, lean: lerp(0.03, -0.08, lk), expr: laugh ? "laugh" : shock ? "shock" : "grin",
        mouthOpen: laugh ? 0.55 + 0.3 * Math.abs(Math.sin(t * 14)) : shock ? 0.6 : 0, headPitch: -0.15 * lk,
        handL: mix([-0.15, 0.95, 0.3], [-0.24, 0.8, 0.18], place), handR });
      this.holdBetween(this.hero, this.heroStack, Math.PI / 2, 0.04, -0.12);
      if (place > 0) this.heroStack.position.lerp(new THREE.Vector3(8.95, 1.25, 45.25), place);
      this.beardPose(t, 0);
    } else if (id === 25) {
      // the payoff: on the curb in the gown, one tiny coffee; sip on "coffee" (f1862-1890)
      const sip = smooth((f - 1858) / 8) * (1 - smooth((f - 1888) / 10));
      this.hero.pose({ pos: CURB, yaw: -Math.PI / 2, lean: 0.12, expr: sip > 0.5 ? "smile_closed" : f > 1890 ? "nervous" : "neutral", blink: sip > 0.5 ? 1 : 0,
        headPitch: -0.12 * sip, headYaw: f < 1840 ? 0.1 * Math.sin(t * 0.8) : 0,
        handL: [-0.2, 0.62, 0.4], handR: [lerp(0.16, 0.05, sip), lerp(0.88, 1.36, sip), lerp(0.36, 0.3, sip)],
        footL: [-0.15, 0.56, 0.52], footR: [0.15, 0.56, 0.52] });
      this.beardPose(t, 0);
      this.attach(this.hero, "R", this.cup, -Math.PI / 2, -0.35 * sip);
      this.cup.position.y -= 0.03;
    }
    // ---- barista-bot (Shots 18-24) ----
    if (id >= 18 && id <= 24) {
      const talking = (f >= 1340 && f < 1390) || (f >= 1410 && f < 1509);
      const place = id === 19 ? smooth((f - 1356) / 10) * (1 - smooth((f - 1372) / 10)) : 0;
      const wave = id === 18 && f > 1296 ? Math.sin(t * 10) : 0;
      const face: BotFace = id === 22 || (id === 21 && f >= 1510) ? "flat" : talking ? "talk" : id === 18 && f > 1290 ? "happy" : f % 80 < 4 ? "blink" : "eyes";
      this.barista.pose({ pos: BARISTA, yaw: -Math.PI / 2 - (id === 18 ? 0.25 : 0), t, face,
        armR: id === 18 && f > 1296 ? 2.6 : lerp(0.2, 1.2, place), spreadR: id === 18 && f > 1296 ? 0.35 + 0.25 * wave : 0.12,
        armL: id === 22 ? 0.9 : 0.2, spreadL: id === 22 ? -0.55 : 0.12, tilt: id === 22 ? 0 : talking ? 0.05 * Math.sin(t * 4) : 0 });
      // the cup: in the bot's hand, then on the counter (f1368+)
      if (id === 19 && f < 1368) { this.barista.hand("R", this.cup.position); this.cup.position.y -= 0.05; this.cup.rotation.set(0, 0, 0); this.cup.visible = f >= 1350; }
      else if (id >= 19) { this.cup.position.set(9.0, 1.25, 45.55); this.cup.rotation.set(0, 0, 0); this.cup.visible = true; }
      this.registerScreen.set(f >= 1451 || id > 20 ? "1" : "0");
    }
    if (id === 16 || id === 17) this.atmScreen.set(f >= 1137 || id === 17 ? "1" : "0");
    if (id >= 18 && id <= 22) { /* pile stays by the ATM off-screen */ }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;
    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = s.set === "city" ? 30 : 9;
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
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = s.set === "city" ? Math.max(L.fogFar, 420) : L.fogFar;
    scene.fog = this.fog;

    // hide every actor / loose prop, then pose what this shot needs
    const rigs = [this.hero, this.heroPast, ...this.peds];
    for (const r of rigs) r.root.visible = false;
    for (const b of [this.nurse, this.barista]) b.root.visible = false;
    for (const o of [this.ivLine, this.phone, this.heroStack, this.cup, this.taxi, ...this.pileBricks, ...this.pedStacks, ...this.drones, ...this.cars.map((c) => c.g)]) o.visible = false;

    if (s.set === "hospital") this.poseHospital(id, f, t);
    else if (s.set === "apartment") this.poseApartment(id, f, t);
    else this.poseCity(id, f, t);

    // camera-clip guard: never let the lens end up inside an actor (its BackSide ink hull would fill the frame)
    for (const r of rigs) {
      if (!r.root.visible) continue;
      const p = r.root.position, dy = cam.position.y - p.y;
      if (dy > -0.2 && dy < 2.0 && Math.hypot(cam.position.x - p.x, cam.position.z - p.z) < 0.5) {
        r.root.visible = false;
        if (r === this.hero) { this.heroStack.visible = this.heroStack.visible && f >= 1395 && id >= 19 && id <= 22; }
      }
    }
    return focus;
  }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
