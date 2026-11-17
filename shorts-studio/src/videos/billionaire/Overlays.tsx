// Crisp DOM overlays above <ThreeCanvas> (never blurred by LensBlur / grade):
//  - BankBanner: push notification that slides down on "billionaire" (Shot 1)
//  - PhoneHUD: his phone screen with a missed-call counter racing to 400 (Shot 5)
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

export const BankBanner: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < start) return null;
  const k = spring({ frame: f - start, fps, config: { damping: 14, stiffness: 160 } });
  const y = interpolate(k, [0, 1], [-260, 96]);
  const zeros = Math.min(9, Math.floor((f - start) / 2));
  const amount = "1" + ",000".repeat(Math.floor(zeros / 3)) + "0".repeat(zeros % 3);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", left: 56, right: 56, top: y, borderRadius: 40, padding: "30px 36px",
        background: "rgba(248,248,252,0.96)", boxShadow: "0 18px 40px rgba(0,0,0,0.35)", display: "flex", gap: 26, alignItems: "center",
        fontFamily: FONT,
      }}>
        <div style={{ width: 96, height: 96, borderRadius: 24, background: "linear-gradient(135deg,#f6d365,#d9a21b)", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 64, fontWeight: 900, color: "#5a3b05" }}>$</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#6b6f7a", letterSpacing: 1 }}>BANK  •  now</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#16181d", marginTop: 4 }}>Deposit received</div>
          <div style={{ fontSize: 54, fontWeight: 900, color: "#1a8f4a", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>+${amount}.00</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CALLERS = ["Cousin Ray", "Cousin Debbie", "\"Cousin\" Phil", "Cousin Ray (again)", "Unknown Cousin", "Aunt Who?", "Cousin Gary", "Cousin Ray"];

export const PhoneHUD: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < start || f >= end) return null;
  const k = spring({ frame: f - start, fps, config: { damping: 16, stiffness: 120 } });
  const y = interpolate(k, [0, 1], [760, 0]);
  const count = Math.round(400 * Math.pow(Math.min(1, Math.max(0, (f - start - 10) / 100)), 1.6));
  const shake = count >= 400 ? 0 : Math.sin(f * 2.1) * 3;
  const rows = Math.min(CALLERS.length, Math.floor((f - start - 6) / 9));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", left: 250, right: 250, bottom: 50, height: 720, transform: `translate(${shake}px, ${y}px)`,
        borderRadius: 70, background: "#111318", border: "14px solid #2a2d36", boxShadow: "0 30px 60px rgba(0,0,0,0.6)",
        fontFamily: FONT, color: "#fff", padding: "56px 36px", boxSizing: "border-box", overflow: "hidden",
      }}>
        <div style={{ fontSize: 34, color: "#9aa0ad", fontWeight: 700 }}>Phone</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 10 }}>
          <span style={{ fontSize: 108, fontWeight: 900, color: "#ff4b4b", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{count}</span>
          <span style={{ fontSize: 38, fontWeight: 800 }}>Missed Calls</span>
        </div>
        <div style={{ marginTop: 30 }}>
          {CALLERS.slice(0, Math.max(0, rows)).map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "2px solid #262a33", fontSize: 30 }}>
              <span style={{ color: "#ff6b6b", fontWeight: 700 }}>{c}</span>
              <span style={{ color: "#7d8492" }}>{`(${[37, 12, 58, 41, 9, 23, 66, 101][i]})`}</span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
