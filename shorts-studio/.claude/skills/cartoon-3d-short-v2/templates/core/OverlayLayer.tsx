// Crisp DOM / SVG overlays rendered ABOVE <ThreeCanvas> so LensBlur DOF and GradeEffect never blur HUD or captions.
// Exports:
// - DiegeticHUD (toggleable in-world camera overlay: blinking REC dot, live date/timestamp, speed readout, FRONT 1080P)
// - DashcamHUD (backward-compatible alias wrapping DiegeticHUD)
// - PopCaptions / ViralSubtitles (bold rounded white sans-serif, thick black stroke, 1-3 words at a time,
//   lower-third safe zone at 77% vertical height, fast 0.92 -> 1.0 pop-in over 3-4 frames)
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type WordItem = { w: string; s: number; e: number; speaker?: string };

/** Vertical safe-zone constants for YouTube Shorts / Reels / TikTok mobile UI clearance (bottom buttons start ~86%). */
export const SUBTITLE_SAFE_ZONE = {
  minTopPct: 72,
  maxBottomPct: 84,
  defaultTopPct: 77,
} as const;

export type DiegeticHudMode = "dashcam" | "bodycam" | "cctv" | "phone_rec";

export type DiegeticHudProps = {
  /** Toggle visibility cleanly per shot (default true) */
  enabled?: boolean;
  /** Visual styling preset for the in-world device lens */
  mode?: DiegeticHudMode;
  /** Speed readout value (shown when showSpeed !== false and mph is defined) */
  mph?: number;
  speedUnit?: "MPH" | "KM/H";
  showSpeed?: boolean;
  /** Date string displayed in telemetry bar (e.g. "1998/10/14") */
  dateText?: string;
  /** Initial HH:MM:SS clock that advances live with the Remotion frame counter */
  startTime?: string;
  /** Legacy prefix string supported for DashcamHUD compatibility (e.g. "1998/10/14  08:14:") */
  timestamp?: string;
  /** Top-right camera lens badge (default "FRONT 1080P") */
  cameraLabel?: string;
  /** Top-left recording indicator label (default "REC") */
  recLabel?: string;
  /** Subtle CRT / CMOS scanline overlay */
  showScanlines?: boolean;
};

const parseStartSeconds = (hhmmss: string): number => {
  const parts = hhmmss.split(":").map((n) => parseInt(n, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
};

const formatClock = (totalSec: number): string => {
  const s = ((Math.floor(totalSec) % 86400) + 86400) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export const DiegeticHUD: React.FC<DiegeticHudProps> = ({
  enabled = true,
  mode = "dashcam",
  mph,
  speedUnit = "MPH",
  showSpeed = mph !== undefined,
  dateText = "2024/10/14",
  startTime = "08:14:22",
  timestamp,
  cameraLabel,
  recLabel = "REC",
  showScanlines = true,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!enabled) return null;

  const elapsedSec = Math.floor(f / fps);
  const blinkOn = Math.floor(f / Math.max(1, Math.round(fps * 0.5))) % 2 === 0;
  const pad2 = (n: number) => String(n % 60).padStart(2, "0");

  const defaultLabel =
    mode === "bodycam"
      ? "AXON BODY 1080P"
      : mode === "cctv"
        ? "CAM-04  1080P"
        : mode === "phone_rec"
          ? "4K 60FPS"
          : "FRONT 1080P";
  const badge = cameraLabel ?? defaultLabel;

  const timeString = timestamp
    ? `${timestamp}${pad2(22 + elapsedSec)}`
    : `${dateText}  ${formatClock(parseStartSeconds(startTime) + elapsedSec)}`;

  const borderCol = mode === "cctv" ? "rgba(180,255,205,0.72)" : "rgba(255,255,255,0.78)";
  const accentText = mode === "cctv" ? "#c8ffd8" : "#f4f7fa";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: "'Courier New', 'JetBrains Mono', monospace", color: accentText }}>
      {/* Barrel lens vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.52) 100%)",
          boxShadow: "inset 0 0 88px rgba(0,0,0,0.72)",
        }}
      />

      {/* Faint scanline texture */}
      {showScanlines && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: mode === "cctv" ? 0.14 : 0.06,
            backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 1px, transparent 1px, transparent 4px)",
          }}
        />
      )}

      {/* Corner viewfinder brackets */}
      {[
        { top: 48, left: 48, borderTop: `4px solid ${borderCol}`, borderLeft: `4px solid ${borderCol}` },
        { top: 48, right: 48, borderTop: `4px solid ${borderCol}`, borderRight: `4px solid ${borderCol}` },
        { bottom: 48, left: 48, borderBottom: `4px solid ${borderCol}`, borderLeft: `4px solid ${borderCol}` },
        { bottom: 48, right: 48, borderBottom: `4px solid ${borderCol}`, borderRight: `4px solid ${borderCol}` },
      ].map((st, idx) => (
        <div key={idx} style={{ position: "absolute", width: 46, height: 46, ...st }} />
      ))}

      {/* Top-Left blinking ● REC Indicator */}
      <div
        style={{
          position: "absolute",
          top: 72,
          left: 78,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textShadow: "0 2px 6px rgba(0,0,0,0.92)",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            backgroundColor: blinkOn ? "#ff2626" : "#4f1010",
            boxShadow: blinkOn ? "0 0 16px #ff2626" : "none",
          }}
        />
        <span>{recLabel}</span>
      </div>

      {/* Top-Right Camera Label (e.g., FRONT 1080P) */}
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 78,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "0.04em",
          opacity: 0.94,
          padding: "4px 12px",
          borderRadius: 6,
          backgroundColor: "rgba(0,0,0,0.34)",
          textShadow: "0 2px 6px rgba(0,0,0,0.92)",
        }}
      >
        {badge}
      </div>

      {/* Bottom Telemetry Bar (kept above mobile safe-zone bottom edge) */}
      <div
        style={{
          position: "absolute",
          bottom: 78,
          left: 78,
          right: 78,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textShadow: "0 2px 8px rgba(0,0,0,0.95)",
        }}
      >
        <span>{timeString}</span>
        {showSpeed && mph !== undefined && (
          <span style={{ color: mph <= 1 ? "#ffd24c" : "#aef7c6" }}>
            {String(Math.round(mph)).padStart(2, "0")} {speedUnit}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Backward-compatible DashcamHUD wrapper over DiegeticHUD. */
export const DashcamHUD: React.FC<{
  mph: number;
  timestamp?: string;
  cameraLabel?: string;
  enabled?: boolean;
}> = ({ mph, timestamp = "1998/10/14  08:14:", cameraLabel = "FRONT 1080P", enabled = true }) => (
  <DiegeticHUD
    enabled={enabled}
    mode="dashcam"
    mph={mph}
    showSpeed={true}
    timestamp={timestamp}
    cameraLabel={cameraLabel}
  />
);

// ---------------- Punchy Viral Subtitles (1-3 words, lower-third safe zone) ----------------

export type SubtitleChunk = {
  words: WordItem[];
  text: string;
  s: number;
  e: number;
  speaker: string;
};

const CLAUSE_END = /[.!?,;:\u2014]$/;

/**
 * Groups word-level timestamps into punchy 1-3 word single-line subtitle cues.
 * Splits cleanly on speaker turns, clause punctuation, natural pauses, or line width (> maxChars)
 * so captions never become multi-line walls of text.
 */
export const chunkWordsForSubtitles = (
  words: WordItem[],
  opts: { maxWords?: number; maxChars?: number; maxGapSec?: number } = {},
): SubtitleChunk[] => {
  const { maxWords = 3, maxChars = 17, maxGapSec = 0.32 } = opts;
  const chunks: SubtitleChunk[] = [];
  let buf: WordItem[] = [];

  const flush = () => {
    if (!buf.length) return;
    chunks.push({
      words: buf,
      text: buf.map((x) => x.w).join(" "),
      s: buf[0].s,
      e: buf[buf.length - 1].e,
      speaker: buf[0].speaker ?? "narrator",
    });
    buf = [];
  };

  for (const raw of words) {
    const wText = (raw.w ?? "").trim();
    if (!wText) continue;
    const item: WordItem = { ...raw, w: wText };
    const spk = item.speaker ?? "narrator";

    if (buf.length > 0) {
      const prev = buf[buf.length - 1];
      const prevSpk = prev.speaker ?? "narrator";
      const projectedChars = buf.reduce((acc, x) => acc + x.w.length + 1, 0) + item.w.length;
      const gap = item.s - prev.e;
      const shouldSplit =
        spk !== prevSpk ||
        buf.length >= maxWords ||
        projectedChars > maxChars ||
        gap > maxGapSec ||
        CLAUSE_END.test(prev.w);
      if (shouldSplit) flush();
    }

    buf.push(item);
    // Keep emphatic long single words or clause-ending words tight
    if (item.w.length >= 12 || CLAUSE_END.test(item.w)) {
      flush();
    }
  }
  flush();
  return chunks;
};

export type PopCaptionsProps = {
  words: WordItem[];
  enabled?: boolean;
  /** Vertical position as % from top (default 77%, safely inside 75-80% lower third clear of bottom UI) */
  topPct?: number;
  /** Max words displayed simultaneously (1-3, default 3) */
  maxWords?: 1 | 2 | 3;
  /** Highlight the currently spoken word inside a 2-3 word chunk */
  highlightActiveWord?: boolean;
  /** Base font size in px at 1080x1920 (default 74) */
  fontSize?: number;
};

export const PopCaptions: React.FC<PopCaptionsProps> = ({
  words,
  enabled = false,
  topPct = SUBTITLE_SAFE_ZONE.defaultTopPct,
  maxWords = 3,
  highlightActiveWord = true,
  fontSize = 74,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chunks = useMemo(() => chunkWordsForSubtitles(words, { maxWords }), [words, maxWords]);
  if (!enabled || !chunks.length) return null;

  const t = f / fps;
  const active = chunks.find((c) => t >= c.s && t < c.e);
  if (!active) return null;

  // Fast, subtle scale pop-in: 0.92 -> 1.0 over 3.5 frames (ease-out)
  const ageFrames = Math.max(0, (t - active.s) * fps);
  const popDuration = 3.5;
  const p = Math.min(1, ageFrames / popDuration);
  const eased = 1 - Math.pow(1 - p, 2.2);
  const popScale = 0.92 + 0.08 * eased;

  // Clamp topPct safely inside lower-third zone (72-82%)
  const clampedTop = Math.max(SUBTITLE_SAFE_ZONE.minTopPct, Math.min(82, topPct));
  const isDialogue = active.speaker !== "narrator";
  const baseColor = isDialogue ? "#ffe46b" : "#ffffff";
  const activeWordColor = isDialogue ? "#ffffff" : "#ffe866";

  // Gently scale down font slightly on wider 3-word phrases so it always stays a crisp single line
  const charCount = active.text.length;
  const adaptiveSize = charCount > 15 ? Math.round(fontSize * 0.88) : fontSize;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${clampedTop}%`,
          left: "5%",
          right: "5%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `translateY(-50%) scale(${popScale.toFixed(4)})`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: "0.24em",
            whiteSpace: "nowrap",
            fontFamily: "'Fredoka', 'Nunito', 'Rubik', 'Arial Rounded MT Bold', 'Montserrat', 'Inter', sans-serif",
            fontWeight: 900,
            fontSize: adaptiveSize,
            lineHeight: 1.05,
            letterSpacing: "-0.015em",
            WebkitTextStroke: "14px #09090b",
            paintOrder: "stroke fill",
            filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
            textAlign: "center",
          }}
        >
          {active.words.map((item, idx) => {
            const isSpeaking = highlightActiveWord && active.words.length > 1 && t >= item.s && t < item.e;
            return (
              <span
                key={`${item.s}_${idx}`}
                style={{
                  color: isSpeaking ? activeWordColor : baseColor,
                }}
              >
                {item.w}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Alias for PopCaptions matching viral shorts terminology. */
export const ViralSubtitles = PopCaptions;
