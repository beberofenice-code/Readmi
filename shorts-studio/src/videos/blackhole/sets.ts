// Modular 3D set registry for "What If You Fell Into a Black Hole?": space (black hole + lensed starfield +
// accretion disk + horizon membrane / firewall), ship (interior cockpit with telescope, later the funeral) and inside
// (the stretched tunnel toward the singularity). Only the active shot's set Group is visible per frame.
import * as THREE from "three";
import { lam } from "../core/build";
import { ctex } from "../core/paint";
import { TONE, CHAR } from "../core/shade";
import { LIGHTS, LOOK } from "../core/lights";
import { NOINK } from "../core/ink";
import { HeroRig25D } from "../core/rig25d";
import {
  Cam, FPS, SHOTS, IN0, R_H, SHIP, astroPos, burnK, camAt, fireK, redK, sh, smooth, stretchS, clamp01, V3,
} from "./story";

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 20) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const col = (key: string, hex: string) => lam(key, () => ({ color: hex }));
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
const noink = <T extends THREE.Object3D>(o: T) => { o.traverse((c) => c.layers.set(NOINK)); return o; };

/** Unlit readable prop: textured face plane + lam backing card (so the card still gets an ink outline) */
const sign = (w: number, h: number, tex: THREE.Texture, backHex = "#2a2f3a") => {
  const g = new THREE.Group();
  const back = box(w + 0.03, h + 0.03, 0.025, col("sign_back_" + backHex, backHex), 0, 0, -0.014);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  face.layers.set(NOINK);
  g.add(back, face);
  return { g, face };
};

const GLSL_NOISE = /* glsl */ `
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;

// ---------------- Lensed starfield / inside-tunnel sky dome ----------------
const makeSky = () => new THREE.ShaderMaterial({
  uniforms: {
    bhPos: { value: new THREE.Vector3() }, camPos: { value: new THREE.Vector3() }, bhR: { value: R_H },
    mode: { value: 0 }, time: { value: 0 }, shadowOn: { value: 1 }, lensK: { value: 1.0 },
  },
  vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: GLSL_NOISE + /* glsl */ `
    uniform vec3 bhPos, camPos; uniform float bhR, mode, time, shadowOn, lensK; varying vec3 vP;
    float stars(vec3 d, float scale, float thr, float rad){
      vec3 q = d * scale; vec3 c = floor(q); float h = h31(c);
      if (h < thr) return 0.0;
      vec3 o = c + 0.5 + 0.35 * (vec3(h31(c + 7.1), h31(c + 3.3), h31(c + 9.7)) - 0.5);
      float dd = length(q - o);
      return smoothstep(rad, 0.0, dd) * (0.5 + 2.5 * fract(h * 91.7));
    }
    void main(){
      vec3 d = normalize(vP);
      vec3 col;
      if (mode < 0.5) {
        vec3 tb = bhPos - camPos; float dist = length(tb); vec3 b = tb / dist;
        float rs = asin(clamp(bhR / dist, 0.0, 1.0));
        float ang = acos(clamp(dot(d, b), -1.0, 1.0));
        // gravitational lensing: the sampled sky direction is bent away from the hole (Einstein-ring look)
        float defl = lensK * rs * rs / max(ang, 1e-3);
        vec3 ax = cross(b, d); float axl = length(ax);
        vec3 ds = d;
        if (axl > 1e-5) { vec3 away = normalize(cross(ax / axl, d)); ds = normalize(d * cos(defl) + away * sin(defl)); }
        float mag = 1.0 + 2.2 * exp(-max(ang - rs, 0.0) / max(rs * 0.18, 1e-3)) * step(rs, ang);
        float neb = fbm(ds * 2.3);
        col = mix(vec3(0.004, 0.006, 0.018), vec3(0.035, 0.02, 0.07), smoothstep(0.35, 0.8, neb));
        col += vec3(0.02, 0.035, 0.07) * smoothstep(0.55, 0.9, fbm(ds * 4.1 + 3.0));
        float s = stars(ds, 70.0, 0.93, 0.11) + 0.6 * stars(ds, 160.0, 0.9, 0.14);
        col += vec3(1.0, 0.96, 0.9) * s * mag;
        col *= mix(1.0, 0.0, shadowOn * step(ang, rs * 0.995));
      } else {
        // inside: a red-violet tunnel streaming upward, white-hot singularity straight down
        float a = atan(d.z, d.x);
        float y = d.y;
        float streak = fbm(vec3(a * 3.0, y * 2.0 + time * 1.6, 0.5));
        float lines = pow(abs(sin(a * 22.0 + 4.0 * fbm(vec3(a * 2.0, y * 3.0, time * 0.2)))), 8.0);
        col = mix(vec3(0.06, 0.0, 0.05), vec3(0.6, 0.06, 0.12), smoothstep(0.3, 0.8, streak));
        col += vec3(1.2, 0.35, 0.25) * lines * smoothstep(0.2, -0.6, y) * 0.6;
        col += vec3(4.0, 3.2, 2.6) * pow(smoothstep(-0.7, -1.0, y), 3.0);
        col *= 0.6 + 0.4 * smoothstep(1.0, -0.2, y);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});

// ---------------- Accretion disk (additive HDR, Keplerian swirl, Doppler-bright side) ----------------
const makeDisk = () => new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, gain: { value: 1 } },
  vertexShader: "varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: GLSL_NOISE + /* glsl */ `
    uniform float time, gain; varying vec3 vL;
    void main(){
      float r = length(vL.xy); float a = atan(vL.y, vL.x);
      float t = clamp((r - 12.5) / 20.0, 0.0, 1.0);
      float om = 1.6 / pow(r / 12.5, 1.5);
      float sw = a - time * om;
      float bands = fbm(vec3(cos(sw) * r * 0.35, sin(sw) * r * 0.35, r * 0.6));
      float ring = 0.55 + 0.45 * sin(r * 2.1 + 3.0 * bands);
      vec3 c = mix(vec3(3.6, 2.9, 2.2), vec3(2.6, 0.95, 0.25), smoothstep(0.0, 0.35, t));
      c = mix(c, vec3(0.9, 0.12, 0.05), smoothstep(0.35, 1.0, t));
      float inten = pow(1.0 - t, 1.6) * smoothstep(0.0, 0.06, t) * (0.45 + 0.75 * bands) * ring;
      inten *= 1.0 + 0.55 * sin(a + 0.6);
      gl_FragColor = vec4(c * inten * gain, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});

// ---------------- Photon ring + lensed far-side disk halo (camera-facing billboard) ----------------
const makeHalo = () => new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, gain: { value: 1 }, dash: { value: 0 }, rs: { value: R_H } },
  vertexShader: "varying vec2 vU; void main(){ vU = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: GLSL_NOISE + /* glsl */ `
    uniform float time, gain, dash, rs; varying vec2 vU;
    void main(){
      float r = length(vU) / rs; float a = atan(vU.y, vU.x);
      float photon = exp(-pow((r - 1.03) / 0.018, 2.0)) * 3.2;
      float band = smoothstep(1.03, 1.08, r) * smoothstep(1.55, 1.12, r);
      float tb = pow(abs(sin(a)), 1.5);
      float swirl = 0.6 + 0.4 * fbm(vec3(a * 3.0 - time * 0.8, r * 6.0, 1.3));
      vec3 c = vec3(3.2, 1.7, 0.6) * photon + vec3(2.2, 0.8, 0.25) * band * (0.25 + 0.75 * tb) * swirl;
      c += vec3(0.6, 0.25, 0.1) * exp(-max(r - 1.0, 0.0) * 3.0) * step(1.0, r) * 0.35;
      // dashed EVENT HORIZON marker ring (shot 3)
      float dr = exp(-pow((r - 1.17) / 0.012, 2.0)) * step(0.5, fract(a * 9.549 + time * 0.25));
      c += vec3(0.6, 2.2, 2.6) * dr * dash;
      gl_FragColor = vec4(c * gain * step(0.99, r), 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});

// ---------------- Horizon membrane (the "nothing" the infaller passes through) ----------------
const makeMembrane = () => new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, gain: { value: 1 }, hit: { value: new THREE.Vector3(0, 0, R_H) }, hitT: { value: -10 } },
  vertexShader: "varying vec3 vW; varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
  fragmentShader: /* glsl */ `
    uniform float time, gain, hitT; uniform vec3 hit; varying vec3 vW; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 p = normalize(vW);
      float th = acos(clamp(p.y, -1.0, 1.0)), ph = atan(p.z, p.x);
      float g1 = smoothstep(0.07, 0.0, 1.0 - abs(fract(th * 18.0 / 3.14159) - 0.5) * 2.0);
      float g2 = smoothstep(0.07, 0.0, 1.0 - abs(fract(ph * 24.0 / 6.28318) - 0.5) * 2.0);
      float grid = max(g1, g2);
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
      float dh = length(vW - hit);
      float ripple = hitT > 0.0 ? sin(dh * 3.0 - hitT * 9.0) * exp(-dh * 0.45) * exp(-hitT * 0.9) * smoothstep(0.0, 0.5, hitT) : 0.0;
      float fade = smoothstep(0.0, 6.0, length(vV));
      vec3 c = vec3(0.25, 0.9, 1.3) * (grid * 0.5 + fres * 0.06) * fade + vec3(0.6, 1.6, 2.0) * max(ripple, 0.0) * 0.6;
      gl_FragColor = vec4(c * gain, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});

// ---------------- Firewall (outside observer: matter thermalised at the stretched horizon) ----------------
const makeFire = (tongues: boolean) => new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, gain: { value: 0 } },
  vertexShader: "varying vec3 vW; varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
  fragmentShader: GLSL_NOISE + /* glsl */ `
    uniform float time, gain; varying vec3 vW; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 p = normalize(vW);
      float n = fbm(p * 7.0 + vec3(0.0, time * 1.2, time * 0.7));
      float n2 = fbm(p * 19.0 - vec3(time * 2.0, 0.0, time * 1.4));
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
      float k = ${tongues ? "smoothstep(0.52, 0.78, n * 0.7 + n2 * 0.45)" : "0.55 + 0.6 * n + 0.35 * n2"};
      vec3 c = mix(vec3(2.6, 0.55, 0.08), vec3(4.2, 2.6, 0.9), smoothstep(0.5, 0.95, n2));
      gl_FragColor = vec4(c * k * gain * (${tongues ? "0.9" : "0.55"} + fres), 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
});

// ---------------- Inside tunnel wall ----------------
const makeTunnel = () => new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: "varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: GLSL_NOISE + /* glsl */ `
    uniform float time; varying vec3 vL;
    void main(){
      float a = atan(vL.z, vL.x);
      float n = fbm(vec3(a * 2.5, vL.y * 0.12 + time * 2.2, 0.0));
      float l = pow(abs(sin(a * 14.0 + n * 5.0)), 10.0);
      float down = smoothstep(20.0, -60.0, vL.y);
      vec3 c = mix(vec3(0.08, 0.0, 0.06), vec3(0.75, 0.08, 0.16), smoothstep(0.35, 0.8, n));
      c += vec3(1.6, 0.5, 0.3) * l * (0.3 + 0.9 * down);
      c *= 0.35 + 0.9 * down;
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: true, fog: false,
});

// ---------------- Painted textures ----------------
const horizonLabelTex = () => ctex("bh_label", 1024, 300, (g) => {
  g.clearRect(0, 0, 1024, 300);
  g.fillStyle = "rgba(10,14,30,0.82)"; g.fillRect(0, 0, 1024, 300);
  g.strokeStyle = "#7ff4ff"; g.lineWidth = 10; g.strokeRect(8, 8, 1008, 284);
  g.fillStyle = "#e9fdff"; g.font = "bold 118px sans-serif"; g.textAlign = "center";
  g.fillText("EVENT HORIZON", 512, 140);
  g.fillStyle = "#ffb35c"; g.font = "bold 58px sans-serif";
  g.fillText("POINT OF NO RETURN", 512, 236);
});

const screenTex = (key: string, title: string, accent: string, draw: (g: CanvasRenderingContext2D) => void) =>
  ctex("scr_" + key, 512, 320, (g) => {
    g.fillStyle = "#06121c"; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = accent; g.lineWidth = 6; g.strokeRect(6, 6, 500, 308);
    g.fillStyle = accent; g.font = "bold 34px monospace"; g.textAlign = "left"; g.fillText(title, 26, 52);
    draw(g);
  });

const photoTex = () => ctex("bh_photo", 512, 640, (g) => {
  g.fillStyle = "#c8a24a"; g.fillRect(0, 0, 512, 640);
  g.fillStyle = "#1a1e2e"; g.fillRect(30, 30, 452, 500);
  // little portrait: astronaut bean head in a helmet, giving a thumbs-up
  g.fillStyle = "#e9edf3"; g.beginPath(); g.ellipse(256, 470, 150, 120, 0, Math.PI, 0); g.fill();
  g.fillStyle = "rgba(190,225,255,0.35)"; g.beginPath(); g.arc(256, 280, 140, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ffe2c2"; g.beginPath(); g.ellipse(256, 285, 102, 92, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#241726"; g.lineWidth = 8;
  g.beginPath(); g.arc(256, 280, 140, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(256, 285, 102, 92, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#241726";
  g.beginPath(); g.arc(222, 270, 10, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(290, 270, 10, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.beginPath(); g.arc(256, 300, 34, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(200, 205, 30, 14, -0.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#241726"; g.font = "bold 46px serif"; g.textAlign = "center";
  g.fillText("IN LOVING MEMORY", 256, 596);
  // black mourning ribbon across the corner
  g.save(); g.translate(452, 60); g.rotate(Math.PI / 4); g.fillStyle = "#111014"; g.fillRect(-110, -22, 220, 44); g.restore();
});

/** Tint every lit (Lambert/card) material in a rig: used for red-shift dimming and the burn */
const tintRig = (rig: HeroRig25D, c: THREE.Color) => {
  rig.root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
    if (m && (m as THREE.MeshLambertMaterial).isMeshLambertMaterial) m.color.copy(c);
  });
};

export class BlackHoleWorld {
  root = new THREE.Group();
  private sets: Record<string, THREE.Group> = {};
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.6);
  private sun = new THREE.DirectionalLight("#fff3e0", 2.8);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunCache = new Map<number, THREE.Vector3>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpC = new THREE.Color();

  // space set
  private bh = new THREE.Group();
  private core: THREE.Mesh;
  private diskMat: THREE.ShaderMaterial;
  private halo: THREE.Mesh;
  private haloMat: THREE.ShaderMaterial;
  private membrane: THREE.Mesh;
  private membraneMat: THREE.ShaderMaterial;
  private fireIn: THREE.ShaderMaterial;
  private fireOut: THREE.ShaderMaterial;
  private fireMeshes: THREE.Mesh[] = [];
  private label: { g: THREE.Group; face: THREE.Mesh };
  private photons: THREE.Mesh[] = [];
  private trails: THREE.InstancedMesh;
  private ash: THREE.InstancedMesh;
  private embers: THREE.InstancedMesh;
  private exterior: THREE.Group;
  astro: HeroRig25D;
  private helmet: THREE.Group;
  private backpack: THREE.Mesh;
  // ship set
  private friend: HeroRig25D;
  private mourner: HeroRig25D;
  private funeral: THREE.Group;
  private flames: THREE.Mesh[] = [];
  private scopeRig = new THREE.Group();
  // inside set
  private tunnelMat: THREE.ShaderMaterial;
  private debris: THREE.InstancedMesh;

  constructor() {
    const R = this.root;
    this.skyMat = makeSky();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 28), this.skyMat);
    this.sky.layers.set(NOINK);
    this.sky.renderOrder = -10;
    R.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);

    for (const name of ["space", "ship", "inside"]) {
      const g = new THREE.Group();
      this.sets[name] = g;
      R.add(g);
    }

    // ---- Black hole (shared by space + ship window views) ----
    this.core = new THREE.Mesh(new THREE.SphereGeometry(R_H, 64, 48), new THREE.MeshBasicMaterial({ color: "#000000" }));
    this.diskMat = makeDisk();
    const disk = new THREE.Mesh(new THREE.RingGeometry(12.5, 33, 256, 6), this.diskMat);
    const diskTilt = new THREE.Group();
    diskTilt.rotation.set(-Math.PI / 2 + 0.16, 0, 0.1);
    diskTilt.add(disk);
    this.haloMat = makeHalo();
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(R_H * 3.4, R_H * 3.4), this.haloMat);
    this.membraneMat = makeMembrane();
    this.membrane = new THREE.Mesh(new THREE.SphereGeometry(R_H, 96, 64), this.membraneMat);
    this.fireIn = makeFire(false);
    this.fireOut = makeFire(true);
    for (const [rr, m] of [[1.012, this.fireIn], [1.05, this.fireOut], [1.1, this.fireOut]] as [number, THREE.ShaderMaterial][]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(R_H * rr, 96, 64), m);
      this.fireMeshes.push(s);
      this.bh.add(s);
    }
    this.bh.add(this.core, diskTilt, this.halo, this.membrane);
    noink(this.bh);
    R.add(this.bh);

    // ---- SPACE set ----
    const sp = this.sets.space;
    this.label = sign(13, 3.8, horizonLabelTex(), "#141a2e");
    this.label.g.position.set(0, R_H + 4.4, 2);
    sp.add(this.label.g);
    const phGeo = new THREE.SphereGeometry(0.42, 16, 12);
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(phGeo, glow(4.5, 4.0, 2.6));
      p.layers.set(NOINK);
      this.photons.push(p);
      sp.add(p);
    }
    this.trails = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), glow(2.2, 1.6, 0.7), 3 * 14);
    this.trails.layers.set(NOINK);
    sp.add(this.trails);
    this.ash = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.045), new THREE.MeshBasicMaterial({ color: "#4a4246" }), 320);
    this.ash.layers.set(NOINK);
    this.embers = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.03), glow(3.5, 1.2, 0.25), 90);
    this.embers.layers.set(NOINK);
    sp.add(this.ash, this.embers);

    // ship exterior (shot 12): white capsule hull, glowing window strip, engine glow
    this.exterior = new THREE.Group();
    const hullMat = col("hull_white", "#e9ecf1");
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 5.2, 10, 24), hullMat);
    hull.rotation.z = Math.PI / 2; hull.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(1.52, 2.0, 8, 24), col("hull_stripe", "#e2563b"));
    stripe.rotation.z = Math.PI / 2; stripe.scale.set(1, 1, 1);
    const winStrip = box(3.2, 0.35, 0.05, glow(2.4, 1.9, 1.1), 0.2, 0.35, 1.47);
    winStrip.layers.set(NOINK);
    const finMat = col("hull_fin", "#3d6fb5");
    const finT = box(1.6, 1.4, 0.12, finMat, -3.0, 1.3, 0); finT.rotation.z = -0.5;
    const finB = box(1.6, 1.4, 0.12, finMat, -3.0, -1.3, 0); finB.rotation.z = 0.5;
    const engine = cyl(0.9, 1.1, 0.6, col("hull_dark", "#2d323d"), -4.4, 0, 0); engine.rotation.z = Math.PI / 2;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), glow(0.8, 1.8, 3.6));
    flame.scale.set(1.4, 0.9, 0.9); flame.position.set(-4.9, 0, 0); flame.layers.set(NOINK);
    this.exterior.add(hull, stripe, winStrip, finT, finB, engine, flame);
    sp.add(this.exterior);

    // ---- ASTRONAUT (shared by space + inside) ----
    this.astro = new HeroRig25D(R, { jacket: "#eef0f4", vest: "#f08a2c", hair: undefined, skin: "#ffe2c2" });
    this.helmet = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.33, 28, 20), new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(vec3(0.7, 0.85, 1.0) * (0.06 + 1.1 * f), 1.0); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glass.position.set(0, 0.2, 0);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glow(2.4, 2.4, 2.4));
    glint.scale.set(1.4, 0.6, 0.3); glint.position.set(-0.14, 0.36, 0.25); glint.rotation.z = 0.6;
    const ringMat = new THREE.MeshBasicMaterial({ color: "#9aa3b3" });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 10, 28), ringMat);
    collar.rotation.x = Math.PI / 2; collar.position.set(0, -0.08, 0);
    const collarInk = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.058, 10, 28), new THREE.MeshBasicMaterial({ color: "#241726", side: THREE.BackSide }));
    collarInk.rotation.x = Math.PI / 2; collarInk.position.copy(collar.position);
    this.helmet.add(glass, glint, collar, collarInk);
    noink(this.helmet);
    this.astro.headPivot.add(this.helmet);
    this.backpack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.16), new THREE.MeshBasicMaterial({ color: "#c9ced8" }));
    this.backpack.position.set(0, 0.26, -0.24);
    const bpInk = new THREE.Mesh(this.backpack.geometry, new THREE.MeshBasicMaterial({ color: "#241726", side: THREE.BackSide }));
    bpInk.scale.setScalar(1.07);
    this.backpack.add(bpInk);
    noink(this.backpack);
    this.astro.torsoPivot.add(this.backpack);

    // ---- SHIP interior (local coordinates under the SHIP offset; window faces -z toward the black hole) ----
    const ship = this.sets.ship;
    ship.position.set(...SHIP);
    const panel = ctex("ship_panel", 512, 512, (g) => {
      g.fillStyle = "#cfd5de"; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "#9aa2ae"; g.lineWidth = 6;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
      g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
      g.fillStyle = "#8e96a3";
      for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(20 + j * 256 * 0.5 + (j % 2) * 216, 20 + i * 64, 5, 0, 7); g.fill(); }
    });
    panel.repeat.set(2, 1);
    const wallMat = lam("ship_wall", () => ({ color: "#ffffff", map: panel }));
    const floorMat = lam("ship_floor", () => ({ color: "#5d6574" }));
    const trimMat = col("ship_trim", "#3a4150");
    ship.add(box(6.2, 0.1, 5.2, floorMat, -0.3, -0.05, 0.4));
    // back wall with a window opening (x -1.4..1.4, y 0.75..2.45) at z = -2.0
    ship.add(box(2.0, 3.0, 0.16, wallMat, -2.4, 1.5, -2.0), box(2.0, 3.0, 0.16, wallMat, 2.4, 1.5, -2.0));
    ship.add(box(2.8, 0.75, 0.16, wallMat, 0, 0.375, -2.0), box(2.8, 0.55, 0.16, wallMat, 0, 2.725, -2.0));
    for (const [w, h, x, y] of [[3.0, 0.12, 0, 0.72], [3.0, 0.12, 0, 2.48], [0.12, 1.86, -1.46, 1.6], [0.12, 1.86, 1.46, 1.6]]) {
      ship.add(box(w, h, 0.24, trimMat, x, y, -1.98));
    }
    ship.add(box(0.06, 1.7, 0.08, trimMat, 0, 1.6, -2.0)); // window mullion
    ship.add(box(0.16, 3.0, 5.2, wallMat, -3.4, 1.5, 0.4)); // left wall
    // console along the left wall with unlit screens
    ship.add(box(0.9, 0.9, 2.6, col("ship_console", "#4a5263"), -2.9, 0.45, -0.3));
    const scrA = sign(0.8, 0.5, screenTex("clock", "SUIT CLOCK", "#7ff4ff", (g) => {
      g.fillStyle = "#e9fdff"; g.font = "bold 96px monospace"; g.fillText("00:12", 60, 200);
      g.fillStyle = "#ff6a5c"; g.font = "bold 30px monospace"; g.fillText("RATE  SLOWING...", 30, 280);
    }), "#1a2030");
    scrA.g.position.set(-2.75, 1.25, -0.9); scrA.g.rotation.set(-0.35, Math.PI / 2, 0, "YXZ");
    const scrB = sign(0.8, 0.5, screenTex("dist", "DIST TO HORIZON", "#ffb35c", (g) => {
      g.strokeStyle = "#ffb35c"; g.lineWidth = 5; g.beginPath();
      for (let x = 0; x <= 460; x += 4) { const y = 260 - 170 * Math.exp(-x / 160); if (x === 0) g.moveTo(26 + x, y); else g.lineTo(26 + x, y); }
      g.stroke();
      g.fillStyle = "#ffe0b8"; g.font = "bold 40px monospace"; g.fillText("→ 0 km", 280, 120);
    }), "#1a2030");
    scrB.g.position.set(-2.75, 1.25, 0.15); scrB.g.rotation.set(-0.35, Math.PI / 2, 0, "YXZ");
    ship.add(scrA.g, scrB.g);
    for (let k = 0; k < 6; k++) {
      const led = box(0.05, 0.05, 0.05, glow(k % 2 ? 0.3 : 2.4, k % 2 ? 2.2 : 0.4, 0.3), -2.46, 0.86, -1.3 + k * 0.45);
      led.layers.set(NOINK);
      ship.add(led);
    }
    // ceiling light strip (glow only; no ceiling slab so the sun still lights the room)
    const strip = box(0.18, 0.05, 3.6, glow(2.2, 2.2, 2.0), -1.2, 2.95, 0.2); strip.layers.set(NOINK);
    ship.add(strip);
    // telescope on a tripod, pointing out the window
    const metal = col("scope_metal", "#2f3644"), brass = col("scope_brass", "#c99a3c");
    const tube = cyl(0.11, 0.09, 1.1, col("scope_tube", "#e8ecf2"), 0, 0, 0, 24);
    tube.rotation.x = Math.PI / 2 - 0.08;
    const scope = new THREE.Group();
    scope.add(tube, cyl(0.125, 0.125, 0.08, brass, 0, 0.044, -0.55, 24).rotateX(Math.PI / 2 - 0.08), cyl(0.035, 0.035, 0.16, metal, 0, -0.045, 0.6).rotateX(Math.PI / 2 - 0.08));
    scope.position.set(0.1, 1.38, -1.25);
    this.scopeRig.add(scope);
    ship.add(this.scopeRig);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3;
      const leg = cyl(0.018, 0.018, 1.42, metal, 0.1 + Math.cos(a) * 0.22, 0.66, -1.25 + Math.sin(a) * 0.22);
      leg.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32);
      this.scopeRig.add(leg);
    }
    this.friend = new HeroRig25D(ship, { jacket: "#4f6fd6", vest: undefined, tie: undefined, hair: "#3b2418", skin: "#f5c9a0" });
    this.mourner = new HeroRig25D(ship, { jacket: "#25232b", tie: "#111014", hair: "#3b2418", skin: "#f5c9a0" });
    for (const rig of [this.friend, this.mourner]) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshBasicMaterial({ color: "#3b2418" }));
      bun.position.set(0, 0.42, -0.14);
      const bunInk = new THREE.Mesh(bun.geometry, new THREE.MeshBasicMaterial({ color: "#241726", side: THREE.BackSide }));
      bunInk.scale.setScalar(1.12);
      bun.add(bunInk);
      noink(bun);
      rig.headPivot.add(bun);
    }
    // funeral props (shot 13): table, urn, framed photo, candles
    this.funeral = new THREE.Group();
    const wood = col("fun_table", "#6b4632");
    this.funeral.add(box(1.1, 0.06, 0.6, wood, 0, 0.84, 0), cyl(0.05, 0.07, 0.82, wood, 0, 0.41, 0));
    this.funeral.add(box(1.14, 0.02, 0.64, col("fun_cloth", "#3a2a48"), 0, 0.88, 0));
    const urnPts = [[0, 0], [0.09, 0], [0.1, 0.03], [0.07, 0.06], [0.12, 0.14], [0.13, 0.22], [0.09, 0.3], [0.06, 0.33], [0.08, 0.35], [0.03, 0.4], [0, 0.41]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const urn = new THREE.Mesh(new THREE.LatheGeometry(urnPts, 28), col("urn", "#5f7fa8"));
    urn.position.set(0.22, 0.89, 0.05); urn.castShadow = true;
    const urnBand = cyl(0.132, 0.132, 0.03, col("urn_band", "#e8c45a"), 0.22, 1.08, 0.05, 28);
    const photo = sign(0.34, 0.425, photoTex(), "#8a6a2a");
    photo.g.position.set(-0.22, 1.13, -0.08); photo.g.rotation.set(-0.12, 0, 0);
    this.funeral.add(urn, urnBand, photo.g);
    for (const cx of [-0.46, 0.45]) {
      this.funeral.add(cyl(0.03, 0.03, 0.18, col("candle", "#f3ead8"), cx, 0.98, 0.12));
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), glow(3.8, 2.4, 0.9));
      fl.scale.set(1, 1.7, 1); fl.position.set(cx, 1.1, 0.12); fl.layers.set(NOINK);
      this.flames.push(fl);
      this.funeral.add(fl);
    }
    this.funeral.position.set(-0.35, 0, -1.25);
    ship.add(this.funeral);

    // ---- INSIDE set ----
    const ins = this.sets.inside;
    ins.position.set(...IN0);
    this.tunnelMat = makeTunnel();
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(9, 2.5, 140, 64, 1, true), this.tunnelMat);
    tunnel.position.y = -40;
    tunnel.layers.set(NOINK);
    const sing = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 16), glow(6, 5, 4.2));
    sing.position.y = -105; sing.layers.set(NOINK);
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1.4, 0.03), glow(2.0, 0.8, 0.6), 160);
    this.debris.layers.set(NOINK);
    ins.add(tunnel, sing, this.debris);
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

  private poseAstroSpace(id: number, f: number, t: number) {
    const a = astroPos(f);
    const bob = 0.05 * Math.sin(t * 1.3);
    const wave = Math.sin(t * 9);
    const cam = camAt(id, f);
    const faceCam = Math.atan2(cam.pos[0] - a[0], cam.pos[2] - a[2]);
    const floatFeet = { footL: [-0.16, 0.12 + 0.03 * Math.sin(t * 1.7), 0.14] as V3, footR: [0.15, 0.07 + 0.03 * Math.sin(t * 1.9 + 1), 0.06] as V3 };
    if (id === 1) {
      this.astro.pose({ pos: [a[0], a[1] + bob, a[2]], yaw: 0.35, expr: "smile", headYaw: 0.2, ...floatFeet,
        handL: [-0.34, 0.86, 0.18], handR: [0.42, 1.5 + 0.06 * wave, 0.14] });
    } else if (id === 2) {
      this.astro.pose({ pos: [a[0], a[1] + bob, a[2]], yaw: faceCam * 0.6, expr: f > 200 ? "grin" : "smile", ...floatFeet,
        blink: Math.floor(f / 3) % 41 === 0 ? 1 : 0,
        handL: [-0.32, 0.84, 0.2], handR: f < 236 ? [0.46, 1.55 + 0.08 * wave, 0.1] : [0.34, 0.92, 0.24] });
    } else if (id === 5 || id === 7) {
      // through the telescope: waving at the ship, then slowing (the wave freezes with the clock)
      const slow = id === 7 ? Math.max(0, 1 - clamp01((f - 742) / 85) ** 0.6) : 1;
      const tt = id === 7 ? 742 / FPS + (f - 742) / FPS * (0.5 * slow + 0.0) : t;
      const w = Math.sin(Math.min(tt, 812 / FPS) * 9);
      this.astro.pose({ pos: [a[0], a[1], a[2]], yaw: 0.08, expr: "grin", ...floatFeet,
        handL: [-0.32, 0.84, 0.2], handR: [0.46, 1.55 + 0.08 * w, 0.1] });
    } else if (id === 6) {
      this.astro.pose({ pos: [a[0], a[1] + bob, a[2]], yaw: faceCam, expr: "grin", ...floatFeet,
        mouthOpen: f < 740 ? 0.55 * Math.abs(Math.sin(t * 13)) : 0,
        handL: [-0.3, 0.86, 0.24], handR: [0.26, 1.24 + 0.04 * wave, 0.34] });
    } else if (id === 8) {
      this.astro.pose({ pos: [a[0], a[1], a[2]], yaw: 0.95, expr: f > 1000 ? "shock" : "grin", ...floatFeet,
        handL: [-0.32, 0.84, 0.2], handR: [0.46, 1.6, 0.1] });
    } else if (id === 9) {
      const look = 0.5 * Math.sin(t * 0.9);
      this.astro.pose({ pos: [a[0], a[1] + bob, a[2]], yaw: faceCam - 0.35, expr: f < 1146 ? "neutral" : "smile", headYaw: look, ...floatFeet,
        handL: [-0.36, 0.95 + 0.04 * Math.sin(t * 1.2), 0.12], handR: [0.36, 0.95 + 0.04 * Math.sin(t * 1.4), 0.12] });
    } else if (id === 10) {
      const huh = f >= 1359, hk = smooth((f - 1352) / 14);
      this.astro.pose({ pos: [a[0], a[1] + bob, a[2]], yaw: faceCam, expr: huh ? "shock" : "neutral", headPitch: 0.08 * hk, ...floatFeet,
        headYaw: (1 - hk) * 0.12 * Math.sin(t * 0.8),
        mouthOpen: f >= 1305 && f < 1358 ? 0.5 * Math.abs(Math.sin(t * 12)) : 0,
        handL: [-0.3, 0.86, 0.24], handR: [0.3, 1.05, 0.3] });
    }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene, camOverride?: Cam): THREE.Vector3 {
    const s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], t = f / FPS;

    for (const [k, grp] of Object.entries(this.sets)) grp.visible = k === s.set;

    // camera
    const c = camOverride ?? camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);
    const sunDir = this.shotSun(id, L);

    // light rig + two-tone uniforms (space shots are warmed by the disk light, inside is red)
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 140);
    this.sun.target.position.copy(focus);
    const Rr = 28, sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 10; sc.far = 320; sc.updateProjectionMatrix();
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    if (s.set === "space" && s.light === "night") {
      TONE.uLitCol.value.set(1.35, 1.08, 0.86); TONE.uShadeCol.value.set(0.16, 0.15, 0.3);
      CHAR.uCharTint.value.set(1.0, 0.93, 0.86);
    } else if (s.set === "inside") {
      TONE.uLitCol.value.set(1.3, 0.55, 0.5); TONE.uShadeCol.value.set(0.22, 0.06, 0.2);
      CHAR.uCharTint.value.set(1.0, 0.66, 0.66); CHAR.uSideTint.value.set(0.8, 0.6, 0.85);
    }
    scene.fog = null;

    // sky dome
    const su = this.skyMat.uniforms;
    this.sky.position.copy(cam.position);
    su.camPos.value.copy(cam.position);
    su.bhPos.value.set(0, 0, 0);
    su.mode.value = s.set === "inside" ? 1 : 0;
    su.time.value = t;
    su.shadowOn.value = id === 9 || id === 10 ? 0.0 : 1.0;
    su.lensK.value = s.set === "ship" ? 0.6 : 1.0;

    // black hole objects
    const inSpace = s.set !== "inside";
    this.bh.visible = inSpace;
    this.diskMat.uniforms.time.value = t;
    this.haloMat.uniforms.time.value = t;
    this.halo.quaternion.copy(cam.quaternion);
    this.haloMat.uniforms.dash.value = id === 3 ? smooth((f - 352) / 14) : 0;
    this.core.visible = !(id === 9 || id === 10);
    this.halo.visible = this.core.visible;
    this.membrane.visible = id === 9 || id === 10;
    this.membraneMat.uniforms.time.value = t;
    this.membraneMat.uniforms.gain.value = id === 10 ? 0.45 : 0.8;
    const a0 = astroPos(Math.min(f, 1300));
    this.membraneMat.uniforms.hit.value.set(a0[0], a0[1] + 0.8, R_H);
    this.membraneMat.uniforms.hitT.value = (f - 1206) / FPS;
    const fk = fireK(f);
    for (const m of this.fireMeshes) m.visible = id === 8 && fk > 0.001;
    this.fireIn.uniforms.gain.value = fk; this.fireIn.uniforms.time.value = t;
    this.fireOut.uniforms.gain.value = fk * 1.3; this.fireOut.uniforms.time.value = t;
    this.diskMat.uniforms.gain.value = id === 8 ? 1 + 0.6 * fk : 1;

    // reset per-shot actors
    this.astro.root.visible = false;
    this.astro.root.scale.set(1, 1, 1);
    this.friend.root.visible = false;
    this.mourner.root.visible = false;
    this.label.g.visible = id === 3;
    this.photons.forEach((p) => (p.visible = false));
    this.trails.visible = id === 3;
    this.ash.visible = false; this.embers.visible = false;
    this.exterior.visible = id === 12;
    this.funeral.visible = id === 13;
    this.scopeRig.visible = id !== 13;
    this.astro.headPivot.scale.set(1, 1, 1);
    tintRig(this.astro, this.tmpC.setRGB(1, 1, 1));

    if (s.set === "space") {
      if (id !== 3 && id !== 12) {
        this.poseAstroSpace(id, f, t);
        this.astro.root.rotation.z = 0.06 * Math.sin(t * 0.7);
      }
      if (id === 5 || id === 7 || id === 8) {
        // red-shifted and dimmed as seen from far away; then burning in the firewall
        const rk = redK(f), bk = burnK(f);
        this.tmpC.setRGB(1 - 0.05 * rk, 1 - 0.62 * rk, 1 - 0.75 * rk).multiplyScalar(1 - 0.45 * rk);
        if (id === 8) {
          const hot = smooth((f - 960) / 40) * (1 - smooth((bk - 0.45) / 0.4));
          this.tmpC.lerp(new THREE.Color(3.2, 1.4, 0.35), hot);
          this.tmpC.multiplyScalar(1 - 0.92 * smooth((bk - 0.4) / 0.5));
          this.astro.root.visible = bk < 0.97;
          this.astro.root.scale.setScalar(1 - 0.25 * bk);
        }
        tintRig(this.astro, this.tmpC);
      }
      if (id === 3) {
        // three photons spiral in and never come back out
        const ends = [418, 436, 452];
        const base = [0.4, 2.5, 4.4];
        for (let k = 0; k < 3; k++) {
          const p = this.photons[k];
          const posAt = (ff: number) => {
            const u = clamp01((ff - (ends[k] - 58)) / 58);
            const r = R_H * 0.98 + (26 - R_H) * (1 - u) ** 1.3;
            const th = base[k] + 4.2 * u ** 1.2;
            return this.tmpV.set(Math.cos(th) * r, 3.2 * Math.sin(th * 0.7 + k) * (1 - u), Math.sin(th) * r * 0.55 + 4);
          };
          const visible = f >= ends[k] - 58 && f < ends[k];
          p.visible = visible;
          if (visible) p.position.copy(posAt(f));
          for (let j = 0; j < 14; j++) {
            const ff = f - (j + 1) * 1.6;
            const on = visible && ff >= ends[k] - 58;
            if (on) { posAt(ff); this.m4.makeScale(1 - j / 15, 1 - j / 15, 1 - j / 15); this.m4.setPosition(this.tmpV); }
            else this.m4.makeScale(0, 0, 0);
            this.trails.setMatrixAt(k * 14 + j, this.m4);
          }
        }
        this.trails.instanceMatrix.needsUpdate = true;
        this.label.g.quaternion.copy(cam.quaternion);
        const lk = smooth((f - 356) / 12);
        this.label.g.scale.setScalar(Math.max(0.001, lk * (1 + 0.06 * Math.exp(-(f - 356) / 6))));
      }
      if (id === 8 && f >= 1010) {
        // ash + embers drifting over the horizon surface
        this.ash.visible = true; this.embers.visible = true;
        const a = astroPos(f), age = (f - 1010) / FPS;
        for (let k = 0; k < 320; k++) {
          const h1 = hash(k * 1.37), h2 = hash(k * 2.71), h3 = hash(k * 3.93);
          const sx = (h1 - 0.5) * 0.5, sy = h2 * 1.5, sz = (h3 - 0.5) * 0.3;
          const v = 0.25 + 0.6 * hash(k * 5.1);
          const dx = sx + (h1 - 0.5) * age * v * 1.4, dy = sy - age * 0.35 * h2 + 0.15 * Math.sin(age * 2 + k);
          const dz = sz - age * 0.18;
          this.q.setFromEuler(new THREE.Euler(t * 2 + k, t * 1.3 + k * 0.4, 0));
          const sc2 = 0.7 + 0.6 * hash(k * 7.7);
          this.m4.compose(this.tmpV.set(a[0] + dx, a[1] + 0.2 + Math.max(dy, -0.45), a[2] + dz), this.q, new THREE.Vector3(sc2, sc2, sc2));
          this.ash.setMatrixAt(k, this.m4);
          if (k < 90) {
            const ek = Math.max(0, 1 - age / (1.5 + hash(k * 9.1) * 2.5));
            this.m4.compose(this.tmpV.set(a[0] + dx * 1.3, a[1] + 0.3 + dy + age * 0.25, a[2] + dz), this.q, new THREE.Vector3(ek, ek, ek));
            this.embers.setMatrixAt(k, this.m4);
          }
        }
        this.ash.instanceMatrix.needsUpdate = true;
        this.embers.instanceMatrix.needsUpdate = true;
      }
      if (id === 12) {
        this.exterior.position.set(-2.5, 9.5, 27);
        this.exterior.rotation.set(0.05, -1.25, 0.08);
      }
    } else if (s.set === "ship") {
      if (id === 4) {
        const lift = smooth((f - 572) / 20);
        this.friend.pose({
          pos: [0.55, 0, -0.75], yaw: Math.PI - 0.75, lean: 0.22 * (1 - lift), headPitch: 0.15 * (1 - lift),
          headYaw: 0.5 * lift, expr: lift > 0.5 ? "stern" : "neutral",
          blink: Math.floor(f / 3) % 33 === 0 ? 1 : 0,
          handL: [-0.12, 1.28, 0.42], handR: [0.14, 1.18 + 0.04 * smooth((f - 548) / 12), 0.5],
        });
      } else if (id === 13) {
        this.mourner.pose({
          pos: [0.62, 0, -1.0], yaw: -0.75, lean: 0.08, headPitch: 0.2, headYaw: -0.35, expr: "neutral",
          blink: f % 90 > 84 ? 1 : 0,
          handL: [-0.12, 0.92, 0.3], handR: [0.12, 0.92, 0.3],
        });
        this.flames.forEach((fl, k) => fl.scale.set(1, 1.7 + 0.25 * Math.sin(t * 13 + k * 2), 1));
      }
    } else if (s.set === "inside") {
      // spaghettification: feet pulled harder than the head
      const st = stretchS(f);
      const thin = 1 / Math.sqrt(st);
      const cpos = camAt(id, f).pos;
      const yaw = Math.atan2(cpos[0] - IN0[0], cpos[2] - IN0[2]);
      const wave = Math.sin(t * 8);
      if (id === 11) {
        this.astro.pose({ pos: [IN0[0], IN0[1] + 1.5 - 1.5 * st, IN0[2]], yaw, expr: f < 1450 ? "neutral" : "shock",
          handL: [-0.34, 1.32, 0.1], handR: [0.34, 1.32, 0.1], footL: [-0.1, 0.02, 0.04], footR: [0.1, 0.02, 0.04] });
      } else {
        this.astro.pose({ pos: [IN0[0], IN0[1] + 1.5 - 1.5 * st, IN0[2]], yaw, expr: "grin",
          handL: [-0.3, 1.0, 0.1], handR: [0.32 + 0.04 * wave, 1.52, 0.12], footL: [-0.08, 0.02, 0.04], footR: [0.08, 0.02, 0.04] });
      }
      this.astro.root.scale.set(thin, st, thin);
      this.astro.headPivot.scale.set(1 / thin, 1 / st, 1 / thin);
      this.astro.root.rotation.z = (id === 14 ? 0.05 : 0.02) * Math.sin(t * 2.2);
      this.astro.root.updateMatrixWorld(true);
      this.tunnelMat.uniforms.time.value = t;
      for (let k = 0; k < 160; k++) {
        const ang = hash(k * 1.9) * Math.PI * 2, rad = 2.2 + 5.5 * hash(k * 3.3);
        const y = 30 - ((t * (14 + 10 * hash(k * 4.4)) + hash(k * 5.5) * 70) % 70);
        this.m4.makeTranslation(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        this.debris.setMatrixAt(k, this.m4);
      }
      this.debris.instanceMatrix.needsUpdate = true;
    }

    return focus;
  }
}
