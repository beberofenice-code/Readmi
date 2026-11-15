// Crisp DOM signal cards drawn ABOVE <ThreeCanvas> (never blurred by LensBlur / graded by GradeEffect):
// the sailor's rule the whole story turns on. "flash" = one card under the sweeping beam (Shot 5),
// "signals" = both rules stacked, the second one landing on "but a steady one says come on in" (Shot 11).
import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp01, glide, seaFlashK } from "./story";

const INK = "#241726";

const Card: React.FC<{
  top: number; appear: number; f: number; lampK: number; lampCol: string; accent: string; title: string; text: string; dim?: number;
}> = ({ top, appear, f, lampK, lampCol, accent, title, text, dim = 0 }) => {
  const k = glide((f - appear) / 9);
  if (k <= 0) return null;
  const pop = 1 + 0.06 * Math.sin(Math.PI * clamp01((f - appear) / 12));
  return (
    <div
      style={{
        position: "absolute", left: 70, right: 70, top, height: 256, opacity: k * (1 - 0.5 * dim),
        transform: `translateY(${((1 - k) * 60).toFixed(1)}px) scale(${pop.toFixed(3)})`,
        background: "#f5efe2", border: `10px solid ${INK}`, borderRadius: 36, boxShadow: `0 14px 0 ${INK}`,
        display: "flex", alignItems: "center", gap: 36, padding: "0 44px", fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 132, height: 132, borderRadius: "50%", flex: "0 0 auto", border: `10px solid ${INK}`,
          backgroundColor: lampCol, opacity: 1,
          boxShadow: `0 0 ${Math.round(70 * lampK)}px ${Math.round(26 * lampK)}px ${lampCol}`,
          filter: `brightness(${(0.32 + 0.68 * lampK).toFixed(3)})`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 52, fontWeight: 900, color: INK, letterSpacing: "0.04em" }}>{title}</span>
        <span style={{ fontSize: 88, fontWeight: 900, color: accent, lineHeight: 1.0 }}>{text}</span>
      </div>
    </div>
  );
};

export const SignalHUD: React.FC<{ mode: "flash" | "signals"; f: number }> = ({ mode, f }) => {
  if (mode === "flash") {
    const out = 1 - glide((f - 558) / 8);
    return (
      <AbsoluteFill style={{ pointerEvents: "none", opacity: out }}>
        <Card top={1360} appear={470} f={f} lampK={seaFlashK(f)} lampCol="#ffd24c" accent="#c8402f" title="FLASHING LIGHT" text="KEEP AWAY" />
      </AbsoluteFill>
    );
  }
  // 1 Hz demo blink for the "flashing" rule (the real lamp is stuck by now)
  const blink = 0.5 + 0.5 * Math.cos((f - 1237) * ((Math.PI * 2) / 30));
  const out = 1 - glide((f - 1344) / 8);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: out }}>
      <Card top={1130} appear={1232} f={f} lampK={blink ** 3} lampCol="#ffd24c" accent="#c8402f" title="FLASHING LIGHT" text="KEEP AWAY" dim={glide((f - 1292) / 10)} />
      <Card top={1436} appear={1292} f={f} lampK={1} lampCol="#ffd24c" accent="#2f8a4f" title="STEADY LIGHT" text="COME ON IN" />
    </AbsoluteFill>
  );
};
