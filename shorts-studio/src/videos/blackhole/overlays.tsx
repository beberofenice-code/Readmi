// Crisp DOM overlays for the black-hole short (rendered above <ThreeCanvas> so DOF / grade never blur them):
// <ScopeHUD> = the friend's ship-telescope view (time-dilated suit clock, redshift, signal) and <SplitLabels> for shot 12.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { astroPos, R_H, redK, suitClock } from "./story";

const mono = "'DejaVu Sans Mono', 'Courier New', monospace";
const shadow = "0 2px 8px rgba(0,0,0,0.95)";

export const ScopeHUD: React.FC = () => {
  const f = useCurrentFrame();
  const frozen = f >= 827;
  const clk = suitClock(f);
  const mm = Math.floor(clk / 60), ss = clk - mm * 60;
  const clock = `00:${String(mm).padStart(2, "0")}:${ss.toFixed(1).padStart(4, "0")}`;
  const p = Math.max(0, Math.min(1, (f - 603) / 224));
  const z = 1 / (1 - 0.98 * p) - 1;
  const dist = Math.max(0, (astroPos(f)[2] - R_H) * 1000);
  const sig = Math.max(0, Math.round(5 * (1 - redK(f)) ));
  const blink = Math.floor(f / 8) % 2 === 0;
  const cx = 540, cy = 900, rad = 470;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: mono, color: "#dffbff" }}>
      <div style={{ position: "absolute", inset: 0,
        background: `radial-gradient(circle ${rad + 60}px at ${cx}px ${cy}px, rgba(0,0,0,0) ${rad - 8}px, rgba(4,6,12,0.92) ${rad + 4}px, #04060c ${rad + 60}px)` }} />
      <div style={{ position: "absolute", left: cx - rad, top: cy - rad, width: rad * 2, height: rad * 2, borderRadius: "50%",
        border: "5px solid rgba(127,244,255,0.55)", boxShadow: "0 0 30px rgba(127,244,255,0.25)" }} />
      <div style={{ position: "absolute", left: cx - 1, top: cy - rad + 40, width: 2, height: rad * 2 - 80, background: "rgba(127,244,255,0.28)" }} />
      <div style={{ position: "absolute", top: cy - 1, left: cx - rad + 40, height: 2, width: rad * 2 - 80, background: "rgba(127,244,255,0.28)" }} />
      {[0, 90, 180, 270].map((a) => (
        <div key={a} style={{ position: "absolute", left: cx - 30, top: cy - 30, width: 60, height: 60,
          border: "3px solid rgba(255,179,92,0.85)", borderRadius: 6, transform: `rotate(${a}deg)`,
          clipPath: "polygon(0 0, 40% 0, 40% 12%, 12% 12%, 12% 40%, 0 40%)" }} />
      ))}
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center", fontSize: 34, fontWeight: 700, letterSpacing: 3, textShadow: shadow, color: "#7ff4ff" }}>
        SHIP TELESCOPE · ×4000
      </div>
      <div style={{ position: "absolute", top: 196, left: 90, right: 90, display: "flex", justifyContent: "space-between", fontSize: 38, fontWeight: 700, textShadow: shadow }}>
        <span>SUIT CLOCK</span>
        <span style={{ color: frozen ? "#ff6a5c" : "#ffffff" }}>{clock}</span>
      </div>
      <div style={{ position: "absolute", top: 254, left: 90, right: 90, display: "flex", justifyContent: "space-between", fontSize: 32, fontWeight: 700, textShadow: shadow }}>
        <span>REDSHIFT</span>
        <span style={{ color: z > 3 ? "#ff8a5c" : "#dffbff" }}>{frozen ? "z → ∞" : `z = ${z.toFixed(2)}`}</span>
      </div>
      <div style={{ position: "absolute", top: 304, left: 90, right: 90, display: "flex", justifyContent: "space-between", fontSize: 32, fontWeight: 700, textShadow: shadow }}>
        <span>TO HORIZON</span>
        <span>{dist.toFixed(0)} km</span>
      </div>
      <div style={{ position: "absolute", top: 354, left: 90, right: 90, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 32, fontWeight: 700, textShadow: shadow }}>
        <span>SIGNAL</span>
        <span style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2, 3, 4].map((k) => (
            <span key={k} style={{ width: 22, height: 18 + k * 7, alignSelf: "flex-end", background: k < sig ? "#aef7c6" : "rgba(255,255,255,0.18)" }} />
          ))}
        </span>
      </div>
      {frozen && (
        <div style={{ position: "absolute", top: cy + rad - 150, left: 0, right: 0, textAlign: "center", fontSize: 44, fontWeight: 900,
          color: blink ? "#ff4a3c" : "#7a1a14", textShadow: shadow, letterSpacing: 4 }}>
          ■ SIGNAL FROZEN
        </div>
      )}
    </AbsoluteFill>
  );
};

const Label: React.FC<{ top: number; k: number; tag: string; text: string; color: string }> = ({ top, k, tag, text, color }) => (
  <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center",
    opacity: k, transform: `translateY(${(1 - k) * 24}px) scale(${0.94 + 0.06 * k})` }}>
    <div style={{ background: "rgba(8,10,22,0.78)", border: `5px solid ${color}`, borderRadius: 22, padding: "16px 34px",
      fontFamily: "'DejaVu Sans', Inter, sans-serif", fontWeight: 900, textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 30, letterSpacing: 4, color }}>{tag}</div>
      <div style={{ fontSize: 56, color: "#ffffff" }}>{text}</div>
    </div>
  </div>
);

export const SplitLabels: React.FC = () => {
  const f = useCurrentFrame();
  const e = (x: number) => Math.max(0, Math.min(1, x)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, x)));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Label top={150} k={e((f - 1600) / 12)} tag="HER STORY · OUTSIDE" text="burned to ash" color="#ffb35c" />
      <Label top={930} k={e((f - 1640) / 12)} tag="YOUR STORY · INSIDE" text="stretched to spaghetti" color="#7ff4ff" />
    </AbsoluteFill>
  );
};
