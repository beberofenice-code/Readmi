// Crisp DOM HUD for Shot 6, rendered ABOVE <ThreeCanvas> so DOF and the grade never touch the digits:
// two stopwatches side by side, real time vs. the time Milo actually experiences (x100).
import React from "react";
import { AbsoluteFill } from "remotion";

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const Panel: React.FC<{ label: string; value: string; accent: string; big?: boolean }> = ({ label, value, accent, big }) => (
  <div
    style={{
      flex: 1,
      background: "rgba(18,14,24,0.86)",
      border: `6px solid ${accent}`,
      borderRadius: 28,
      padding: "18px 10px 14px",
      textAlign: "center",
      boxShadow: "0 10px 0 rgba(0,0,0,0.35)",
    }}
  >
    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 900, fontSize: 34, letterSpacing: "0.08em", color: accent }}>{label}</div>
    <div style={{ fontFamily: "'DejaVu Sans Mono', monospace", fontWeight: 700, fontSize: big ? 112 : 96, lineHeight: 1.12, color: "#fff6e4" }}>{value}</div>
  </div>
);

/** `appear` 0..1 slides the HUD in; realS / miloS are seconds */
export const DualClockHUD: React.FC<{ realS: number; miloS: number; appear: number; frozen?: boolean }> = ({ realS, miloS, appear, frozen }) => {
  if (appear <= 0) return null;
  const tenths = Math.floor((realS % 1) * 10);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 60,
          right: 60,
          display: "flex",
          gap: 28,
          opacity: appear,
          transform: `translateY(${((1 - appear) * -60).toFixed(1)}px)`,
        }}
      >
        <Panel label="REAL TIME" value={`${fmt(realS)}.${tenths}`} accent="#9fd4ff" />
        <Panel label="MILO TIME" value={fmt(miloS)} accent={frozen ? "#ff5a4c" : "#ffe36e"} big />
      </div>
    </AbsoluteFill>
  );
};
