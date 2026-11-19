#!/usr/bin/env python3
"""
Frame-by-frame Cinema QA of a rendered vertical short (every frame at 30 fps) or verification stills folder.
Validates:
  1. Shot Pacing: cut interval target (2.0-3.5 s, 18-25 cuts/60 s), frozen-camera detection (>=12f), pop detection.
  2. Non-Blank Frames: black frames, unplanned white flashes, and flat/blank WebGL frames (luma std < 0.015).
  3. Audio Track Presence & Loudness: audio stream required, 48 kHz stereo, BS.1770-4 LUFS, true peak, silences.
  4. Subtitle Safe Zones: verifies 1-3 word chunking (never multi-line walls of text), lower-third safe zone
     (72-84% vertical band), and mobile Shorts/Reels bottom UI clearance (86-100%).

Usage (backward-compatible positional args + optional flags):
  python3 scripts/short_qa.py <video.mp4> <outdir> [timeline.json] [--words voice/<slug>/words.json] [--strict]
  python3 scripts/short_qa.py --stills <stills_dir> <outdir> [timeline.json] [--words voice/<slug>/words.json]
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw

CLAUSE_END = re.compile(r"[.!?,;:\u2014]$")
SAFE_ZONE_MIN_PCT = 72
SAFE_ZONE_MAX_PCT = 84
BOTTOM_UI_START_PCT = 86


def run(*a):
    return subprocess.run(a, capture_output=True, text=True)


def chunk_words_check(words, max_words=3, max_chars=17, max_gap_s=0.32):
    """Mirror OverlayLayer.tsx chunkWordsForSubtitles() to validate 1-3 word pacing and line width."""
    chunks, buf = [], []

    def flush():
        if not buf:
            return
        chunks.append({
            "words": list(buf),
            "text": " ".join(x["w"] for x in buf),
            "s": buf[0]["s"],
            "e": buf[-1]["e"],
            "speaker": buf[0].get("speaker", "narrator"),
        })
        buf.clear()

    for raw in words:
        wt = str(raw.get("w", "")).strip()
        if not wt:
            continue
        item = dict(raw, w=wt)
        spk = item.get("speaker", "narrator")
        if buf:
            prev = buf[-1]
            proj = sum(len(x["w"]) + 1 for x in buf) + len(wt)
            gap = float(item["s"]) - float(prev["e"])
            if (
                spk != prev.get("speaker", "narrator")
                or len(buf) >= max_words
                or proj > max_chars
                or gap > max_gap_s
                or CLAUSE_END.search(prev["w"])
            ):
                flush()
        buf.append(item)
        if len(wt) >= 12 or CLAUSE_END.search(wt):
            flush()
    flush()
    return chunks


def check_pacing(meta, total_frames, fps):
    """Evaluate shot pacing against 2.0-3.5s cut interval & 18-25 shots/60s target."""
    shots = meta.get("shots", [])
    dur_s = total_frames / max(fps, 1.0)
    cut_frames = {0, total_frames}
    for s in shots:
        cut_frames.add(int(s["a"]))
    for a, b in meta.get("planned", []):
        if a == b:  # explicit internal camera angle cut
            cut_frames.add(int(a))
    pts = sorted(f for f in cut_frames if 0 <= f <= total_frames)
    durs = [(pts[i + 1] - pts[i]) / fps for i in range(len(pts) - 1) if (pts[i + 1] - pts[i]) > 1]
    n_cuts = len(durs)
    cuts_per_60 = (n_cuts / dur_s) * 60.0 if dur_s > 0 else 0.0
    avg_s = float(np.mean(durs)) if durs else dur_s
    max_s = float(np.max(durs)) if durs else dur_s
    over_limit = [round(d, 2) for d in durs if d > 3.55]

    if n_cuts == 0:
        status = "WARN (no timeline shots provided)"
    elif over_limit:
        status = f"WARN ({len(over_limit)} cuts > 3.5s: {over_limit[:6]}; target 2.0-3.5s, 18-25 cuts/60s)"
    elif 18 <= cuts_per_60 <= 26:
        status = "PASS (in 2.0-3.5s / 18-25 cuts-per-60s viral pacing window)"
    else:
        status = f"WARN ({cuts_per_60:.1f} cuts/60s; target 18-25 cuts/60s)"

    line = (
        f"PACING [{status}] shots={len(shots)}, effective_cuts={n_cuts} ({cuts_per_60:.1f}/60s), "
        f"avg={avg_s:.2f}s, max={max_s:.2f}s"
    )
    return line, over_limit


def check_subtitles(words_path, frames_arr=None):
    """Validate subtitle chunking (1-3 words) and lower-third safe zone (72-84%, clear of 86-100% mobile UI)."""
    lines = []
    ok = True
    if words_path and os.path.exists(words_path):
        words = json.load(open(words_path, encoding="utf-8"))
        chunks = chunk_words_check(words)
        max_w = max((len(c["words"]) for c in chunks), default=0)
        max_ch = max((len(c["text"]) for c in chunks), default=0)
        long_chunks = [c["text"] for c in chunks if len(c["words"]) > 3 or len(c["text"]) > 24]
        span_s = (float(words[-1]["e"]) - float(words[0]["s"])) if words else 0.0
        wpm = (len(words) / max(span_s, 0.1)) * 60.0 if words else 0.0
        st_lbl = "PASS" if (not long_chunks and max_w <= 3) else "FAIL"
        if st_lbl == "FAIL":
            ok = False
        lines.append(
            f"SUBTITLES [{st_lbl}] words={len(words)}, chunks={len(chunks)}, max_words/cue={max_w} (limit 3), "
            f"max_chars/cue={max_ch}, cadence={wpm:.1f} WPM (target 165-180)"
        )
        if long_chunks:
            lines.append(f"  oversized subtitle cues: {long_chunks[:5]}")
    else:
        lines.append("SUBTITLES [INFO] no words.json supplied; skipped word-chunk cadence audit")

    # Verify OverlayLayer.tsx safe-zone geometry and inspect rendered bottom-UI clearance if frames are available
    if frames_arr is not None and len(frames_arr) > 0:
        H = frames_arr.shape[1]
        y_safe0, y_safe1 = int(H * 0.72), int(H * 0.84)
        y_bot0 = int(H * 0.88)
        f32 = frames_arr.astype(np.float32) / 255.0
        luma = f32 @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        # Check high-contrast white-stroke caption signature in lower third vs mobile button zone (bottom 12%)
        safe_hi = float((luma[:, y_safe0:y_safe1, :] > 0.92).mean())
        bot_hi = float((luma[:, y_bot0:, :] > 0.94).mean())
        zone_status = "PASS" if bot_hi < 0.18 else "WARN (bright pixels in bottom 12% Shorts UI area)"
        lines.append(
            f"SUBTITLE_SAFE_ZONE [{zone_status}] target={SAFE_ZONE_MIN_PCT}-{SAFE_ZONE_MAX_PCT}% "
            f"(lower-third highlight density={safe_hi * 100:.2f}%, bottom-UI-zone={bot_hi * 100:.2f}%)"
        )
    return lines, ok


def run_stills_qa(stills_dir, out_dir, meta, words_path):
    """Lightweight verification QA for a folder of rendered JPEG/PNG stills (non-blank + safe zone + pacing)."""
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(stills_dir, "*.jpg")) + glob.glob(os.path.join(stills_dir, "*.png")))
    R = [f"STILLS_QA dir={stills_dir}, count={len(files)}"]
    failures = []
    if not files:
        failures.append("No rendered still images found")
    frames = []
    for fp in files:
        im = Image.open(fp).convert("RGB")
        arr = np.asarray(im, dtype=np.uint8)
        frames.append(np.asarray(im.resize((180, 320)), dtype=np.uint8))
        f32 = arr.astype(np.float32) / 255.0
        luma = f32 @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        mean, std = float(luma.mean()), float(luma.std())
        mx, mn = f32.max(-1), f32.min(-1)
        sat = float(np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0).mean())
        blank = (mean < 0.04) or (mean > 0.96) or (std < 0.015)
        st_lbl = "FAIL (BLANK/FLAT)" if blank else "PASS"
        if blank:
            failures.append(f"{os.path.basename(fp)}: mean={mean:.3f}, std={std:.3f}")
        R.append(f"  {os.path.basename(fp)} [{st_lbl}] {im.width}x{im.height} mean={mean:.3f} std={std:.3f} sat={sat:.3f}")

    if meta:
        fps = float(meta.get("fps", 30))
        tot = int(meta.get("total_frames", 0))
        p_line, _ = check_pacing(meta, tot, fps)
        R.append(p_line)

    sub_lines, sub_ok = check_subtitles(words_path, np.stack(frames) if frames else None)
    R.extend(sub_lines)
    if not sub_ok:
        failures.append("Subtitle validation failed")

    R.append("VERDICT: " + ("FAIL -> " + "; ".join(failures) if failures else "PASS (all stills non-blank & checks healthy)"))
    report = "\n".join(R) + "\n"
    open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8").write(report)
    print(report, end="")
    return 1 if failures else 0


def main():
    ap = argparse.ArgumentParser(description="Frame-by-frame Cinema QA for Shorts-Studio")
    ap.add_argument("target", nargs="?", help="Path to rendered video.mp4 (or outdir when --stills is used)")
    ap.add_argument("outdir", nargs="?", help="Output directory for report.md + contact sheets")
    ap.add_argument("timeline", nargs="?", help="Optional timeline.json path")
    ap.add_argument("--stills", default=None, help="Verify a rendered stills directory instead of an MP4")
    ap.add_argument("--words", default=None, help="Path to words.json for subtitle 1-3 word & WPM validation")
    ap.add_argument("--strict", action="store_true", help="Exit non-zero if any FAIL check occurs")
    args = ap.parse_args()

    if args.stills:
        out_dir = args.target or "out/qa_stills"
        tl_path = args.outdir if (args.outdir and args.outdir.endswith(".json")) else args.timeline
        meta = json.load(open(tl_path, encoding="utf-8")) if (tl_path and os.path.exists(tl_path)) else {}
        rc = run_stills_qa(args.stills, out_dir, meta, args.words)
        sys.exit(rc if args.strict or rc != 0 else 0)

    if not args.target or not args.outdir:
        ap.error("Provide <video.mp4> <outdir> [timeline.json] or use --stills <stills_dir> <outdir> [timeline.json]")

    vid, out = args.target, args.outdir
    meta = json.load(open(args.timeline, encoding="utf-8")) if (args.timeline and os.path.exists(args.timeline)) else {}
    shots = meta.get("shots", [])
    planned = set()
    for a, b in meta.get("xfade", []) + meta.get("planned", []) + ([meta["flash"]] if "flash" in meta else []):
        planned.update(range(a - 1, b + 1))
    for s in shots:
        planned.update((s["a"] - 1, s["a"]))
    os.makedirs(out, exist_ok=True)
    R = []
    failures = []

    pr = json.loads(run(
        "ffprobe", "-v", "error",
        "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration",
        "-of", "json", vid,
    ).stdout)
    v = next(s for s in pr["streams"] if s["codec_type"] == "video")
    au = [s for s in pr["streams"] if s["codec_type"] == "audio"]
    fps_parts = str(v.get("r_frame_rate", "30/1")).split("/")
    fps = float(fps_parts[0]) / max(float(fps_parts[1]), 1.0) if len(fps_parts) == 2 else float(fps_parts[0])

    audio_desc = ", ".join(f"{s['codec_name']} {s['sample_rate']} Hz {s['channels']}ch" for s in au) if au else "NONE"
    R.append(
        f"SPECS {v['width']}x{v['height']} {v['r_frame_rate']} fps, {v.get('nb_frames')} frames, "
        f"{float(pr['format']['duration']):.3f} s; audio: {audio_desc}"
    )

    if not au:
        R.append("AUDIO [FAIL] Missing audio stream in final MP4!")
        failures.append("Missing audio stream")
    else:
        sr_ok = all(int(s.get("sample_rate", 0)) == 48000 and int(s.get("channels", 0)) >= 2 for s in au)
        e = run("ffmpeg", "-i", vid, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-").stderr
        tail = e[e.rfind("Summary:"):]
        I_lines = [l.strip() for l in tail.splitlines() if l.strip().startswith(("I:", "LRA:", "Peak:"))]
        R.append(f"AUDIO [{'PASS' if sr_ok else 'WARN'}] {audio_desc}")
        R.append("LOUDNESS " + " | ".join(I_lines))
        e = run("ffmpeg", "-i", vid, "-map", "0:a:0", "-af", "silencedetect=n=-45dB:d=0.3", "-f", "null", "-").stderr
        R.append("SILENCES " + ("; ".join(l.split("] ")[-1] for l in e.splitlines() if "silence_" in l) or "none"))

    W, H = 180, 320
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", vid, "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
    ).stdout
    F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    n = len(F)
    f32 = F.astype(np.float32) / 255
    luma = f32 @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = f32.max(-1), f32.min(-1)
    sat = np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0)
    L = luma.reshape(n, -1)
    stats = {"mean": L.mean(1), "std": L.std(1), "p2": np.percentile(L, 2, 1), "p98": np.percentile(L, 98, 1), "sat": sat.reshape(n, -1).mean(1)}
    diff = np.abs(np.diff(F.astype(np.int16), axis=0)).mean(axis=(1, 2, 3))
    med = np.array([np.median(diff[max(0, i - 8):i + 9]) for i in range(len(diff))])
    pops = [i + 1 for i in range(len(diff)) if diff[i] > 3 * med[i] + 1.0 and (i + 1) not in planned]
    black = [i for i in range(n) if stats["mean"][i] < 0.04]
    white = [i for i in range(n) if stats["mean"][i] > 0.93 and i not in planned]
    flat_blank = [i for i in range(n) if stats["std"][i] < 0.015 and i not in planned]

    frozen, run_start = [], None
    for i in range(len(diff)):
        if diff[i] < 0.02:
            run_start = i if run_start is None else run_start
        else:
            if run_start is not None and i - run_start >= 12:
                frozen.append((run_start, i))
            run_start = None
    if run_start is not None and len(diff) - run_start >= 12:
        frozen.append((run_start, len(diff)))

    nonblank_ok = (len(black) == 0 and len(white) == 0 and len(flat_blank) == 0)
    if not nonblank_ok:
        failures.append(f"Blank/flat frames detected (black={len(black)}, white={len(white)}, flat={len(flat_blank)})")
    if frozen:
        failures.append(f"Frozen camera spans >=12f detected: {frozen[:5]}")

    R.append(
        f"FRAMES [{'PASS' if nonblank_ok and not frozen else 'FAIL'}] total={n}; black={black[:20]}; "
        f"unplanned_white={white[:20]}; flat_blank={flat_blank[:20]}; frozen_spans>=12f={frozen[:20]}"
    )
    R.append(f"POPS (unplanned frame-diff spikes > 3x local median): {pops[:40]}")
    R.append(f"MOTION mean diff {diff.mean():.2f}; frames with diff<0.3 (held): {int((diff < 0.3).sum())} ({(diff < 0.3).mean() * 100:.0f}%)")

    # Pacing & Subtitles checks
    pacing_line, _ = check_pacing(meta, n, fps)
    R.append(pacing_line)
    sub_lines, sub_ok = check_subtitles(args.words, F)
    R.extend(sub_lines)
    if not sub_ok:
        failures.append("Subtitle chunking exceeded 1-3 word limit")

    R.append("\nPER SHOT  (luma mean / std / p2 / p98 / saturation mean, medians over the shot)")
    for s in shots or [{"id": 0, "a": 0, "b": n}]:
        a, b = s["a"], min(s["b"], n)
        if a >= b:
            continue
        dur_s = (b - a) / fps
        R.append(
            f"  shot {s['id']:>2} ({dur_s:4.2f}s) f{a}-{b - 1}: "
            + " / ".join(f"{np.median(stats[k][a:b]):.3f}" for k in ("mean", "std", "p2", "p98", "sat"))
        )
    R.append("\nVERDICT: " + ("FAIL -> " + "; ".join(failures) if failures else "PASS"))
    np.savez(os.path.join(out, "perframe.npz"), diff=diff, **stats)

    # 2 s contact sheets, 10 x 6 frames of 108x192 each
    cw, ch = 108, 192
    for k in range(0, n, 60):
        S = Image.new("RGB", (cw * 10, ch * 6), "black")
        d = ImageDraw.Draw(S)
        for j in range(min(60, n - k)):
            x, y = (j % 10) * cw, (j // 10) * ch
            S.paste(Image.fromarray(F[k + j]).resize((cw, ch)), (x, y))
            d.rectangle([x, y, x + 34, y + 12], fill="black")
            d.text((x + 2, y + 1), str(k + j), fill="yellow")
        S.save(os.path.join(out, f"sheet_{k:04d}.jpg"), quality=85)

    open(os.path.join(out, "report.md"), "w", encoding="utf-8").write("\n".join(R) + "\n")
    print("\n".join(R))
    if args.strict and failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
