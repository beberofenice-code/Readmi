// Crisp DOM / SVG overlays rendered ABOVE <ThreeCanvas> so LensBlur DOF and GradeEffect never blur UI or captions.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type WordItem = { w: string; s: number; e: number; speaker?: string };

export const DashcamHUD: React.FC<{ mph: number; timestamp?: string }> = ({ mph, timestamp = "1998/10/14  08:14:" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = Math.floor(f / fps);
  const blinkOn = Math.floor(f / 15) % 2 === 0;
  const pad2 = (n: number) => String(n % 60).padStart(2, "0");

  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: "'Courier New', monospace", color: "#f4f7fa" }}>
      {/* Fisheye barrel vignette + subtle scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.52) 100%)",
          boxShadow: "inset 0 0 90px rgba(0,0,0,0.75)",
        }}
      />
      {/* Corner framing brackets */}
      {[
        { top: 48, left: 48, borderTop: "4px solid rgba(255,255,255,0.7)", borderLeft: "4px solid rgba(255,255,255,0.7)" },
        { top: 48, right: 48, borderTop: "4px solid rgba(255,255,255,0.7)", borderRight: "4px solid rgba(255,255,255,0.7)" },
        { bottom: 48, left: 48, borderBottom: "4px solid rgba(255,255,255,0.7)", borderLeft: "4px solid rgba(255,255,255,0.7)" },
        { bottom: 48, right: 48, borderBottom: "4px solid rgba(255,255,255,0.7)", borderRight: "4px solid rgba(255,255,255,0.7)" },
      ].map((st, idx) => (
        <div key={idx} style={{ position: "absolute", width: 44, height: 44, ...st }} />
      ))}

      {/* Top-Left REC Indicator */}
      <div style={{ position: "absolute", top: 72, left: 78, display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: blinkOn ? "#ff2a2a" : "#551111", boxShadow: blinkOn ? "0 0 14px #ff2a2a" : "none" }} />
        <span>REC</span>
      </div>

      {/* Top-Right Resolution Badge */}
      <div style={{ position: "absolute", top: 72, right: 78, fontSize: 30, fontWeight: 700, opacity: 0.9, textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}>
        CAM-01 [FRONT]
      </div>

      {/* Bottom Telemetry Bar */}
      <div style={{ position: "absolute", bottom: 76, left: 78, right: 78, display: "flex", justifyContent: "space-between", fontSize: 32, fontWeight: 700, textShadow: "0 2px 6px rgba(0,0,0,0.95)" }}>
        <span>{timestamp}{pad2(22 + sec)}</span>
        <span style={{ color: mph === 0 ? "#ffd24c" : "#aef7c6" }}>{String(Math.round(mph)).padStart(2, "0")} MPH</span>
      </div>
    </AbsoluteFill>
  );
};

export const PopCaptions: React.FC<{ words: WordItem[]; enabled?: boolean }> = ({ words, enabled = false }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!enabled || !words.length) return null;

  const t = f / fps;
  const active = words.find((w) => t >= w.s && t < w.e);
  if (!active) return null;

  const ageFrames = (t - active.s) * fps;
  const popScale = ageFrames < 3 ? 1.08 - 0.08 * (ageFrames / 3) : 1.0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "67%",
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${popScale.toFixed(3)})`,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, 'Montserrat', sans-serif",
            fontWeight: 900,
            fontSize: 68,
            color: active.speaker && active.speaker !== "narrator" ? "#ffe36e" : "#ffffff",
            WebkitTextStroke: "12px #0b0a0c",
            paintOrder: "stroke fill",
            letterSpacing: "-0.02em",
             filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))",
          }}
        >
          {active.w}
        </span>
      </div>
    </AbsoluteFill>
  );
};
