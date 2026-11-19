#!/usr/bin/env python3
# ElevenLabs voiceover for Shorts-Studio: SCRIPT.md -> voice/<slug>/voice.wav (48 kHz mono s16) + words.json.
#
# Reads every "[SPEAKER] line" or "[SPEAKER:fx] line" (e.g. "[AGENT:phone]") from SCRIPT.md, synthesises each line with
#   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps
# trims dead-air / long breaths (--max-pause, default 0.18 s) while keeping word timestamps locked,
# checks brisk viral narration cadence (165-180 WPM target), converts with ffmpeg to 48000 Hz mono PCM,
# and writes word timings:
#   [{"w": "He", "s": 0.04, "e": 0.18, "speaker": "narrator", "fx": "phone"}, ...]
#
# Env:
#   ELEVENLABS_API_KEY            required (sent as xi-api-key)
#   ELEVENLABS_VOICE_ID           default voice for every speaker
#   ELEVENLABS_VOICE_ID_<SPEAKER> optional per-speaker override, e.g. ELEVENLABS_VOICE_ID_AGENT
#   ELEVENLABS_MODEL_ID           optional, default eleven_multilingual_v2
#   ELEVENLABS_TEMPO              optional pitch-preserving speed-up (same as --tempo), default 1.0
#
# Usage:
#   python3 scripts/elevenlabs_tts.py --script src/videos/dashcam/SCRIPT.md --out-dir voice/dashcam
#   python3 scripts/elevenlabs_tts.py --script ... --dry-run     # parse + show WPM/timing plan, no API calls
# Stdlib only (urllib, wave, json, struct); needs ffmpeg on PATH.
import argparse, base64, hashlib, json, os, re, struct, subprocess, sys, tempfile, time, urllib.error, urllib.request, wave

API = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
SR = 48000
LINE_RE = re.compile(r"^\s*\[([A-Za-z][A-Za-z0-9_ -]*)(?::([A-Za-z0-9_-]+))?\]\s*(.+?)\s*$")
TARGET_WPM_LO = 165.0
TARGET_WPM_HI = 180.0


def parse_script(path):
    """Parse `[SPEAKER]` or `[SPEAKER:fx]` lines from SCRIPT.md -> list of (speaker, fx, text)."""
    lines = []
    for raw in open(path, encoding="utf-8"):
        m = LINE_RE.match(raw)
        if not m:
            continue
        speaker = m.group(1).strip().lower()
        fx = (m.group(2) or "").strip().lower() or None
        text = m.group(3).strip()
        if len(text) >= 2 and text[0] == text[-1] == '"':  # [AGENT] "quoted dialogue"
            text = text[1:-1].strip()
        if text:
            lines.append((speaker, fx, text))
    return lines


def voice_for(speaker):
    key = "ELEVENLABS_VOICE_ID_" + re.sub(r"[^A-Z0-9]", "_", speaker.upper())
    return os.environ.get(key) or os.environ.get("ELEVENLABS_VOICE_ID")


def synth(text, voice_id, api_key, model_id, output_format, retries=3):
    body = json.dumps({"text": text, "model_id": model_id}).encode()
    url = API.format(voice_id=voice_id) + "?output_format=" + output_format
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(
            url, data=body, method="POST",
            headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:500]
            if e.code in (429,) or e.code >= 500:
                if attempt < retries:
                    time.sleep(2 * attempt)
                    continue
            sys.exit(f"[tts] ElevenLabs HTTP {e.code}: {detail}")
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(2 * attempt)
                continue
            sys.exit(f"[tts] Could not reach api.elevenlabs.io ({e.reason}). Is the host allowed by this environment's network?")


def to_pcm48k(audio_bytes, suffix, tempo=1.0):
    """Decode ElevenLabs audio with ffmpeg -> 48 kHz mono s16le samples (bytes); tempo != 1 applies pitch-preserving atempo."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        src = f.name
    try:
        if suffix == ".pcm":  # raw pcm_<rate> output formats
            rate = int(os.environ.get("_EL_PCM_RATE", "44100"))
            cmd = ["ffmpeg", "-v", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", src]
        else:
            cmd = ["ffmpeg", "-v", "error", "-i", src]
        if abs(tempo - 1.0) > 1e-3:
            cmd += ["-af", f"atempo={tempo:.4f}"]
        cmd += ["-ac", "1", "-ar", str(SR), "-f", "s16le", "-acodec", "pcm_s16le", "-"]
        return subprocess.run(cmd, capture_output=True, check=True).stdout
    finally:
        os.unlink(src)


def words_from_alignment(al, speaker, fx, t0, clip_start):
    """Group character timings into words. t0 = clip offset on the output timeline, clip_start = trim point in the clip."""
    chars = al["characters"]
    cs, ce = al["character_start_times_seconds"], al["character_end_times_seconds"]
    out, cur, s, e = [], "", None, None
    for ch, a, b in zip(chars, cs, ce):
        if ch.isspace():
            if cur:
                out.append((cur, s, e))
            cur, s, e = "", None, None
            continue
        if not cur:
            s = a
        cur += ch
        e = b
    if cur:
        out.append((cur, s, e))
    res = []
    for w, a, b in out:
        w = w.strip('"“”')
        if not w:
            continue
        item = {"w": w, "s": round(t0 + a - clip_start, 3), "e": round(t0 + b - clip_start, 3), "speaker": speaker}
        if fx:
            item["fx"] = fx
        res.append(item)
    return res


def trim_dead_air(clip_bytes, clip_words, t_base, max_pause=0.18, keep_pause=0.11):
    """
    Tighten long internal breaths / dead-air gaps (> max_pause seconds) between aligned words
    while remapping word timestamps cleanly so captions stay 100% locked.
    """
    if max_pause <= 0 or len(clip_words) < 2:
        return clip_bytes, clip_words

    # Identify gaps between consecutive words longer than max_pause
    cuts = []  # (rel_start_s, rel_end_s) to excise from clip_bytes
    for i in range(len(clip_words) - 1):
        g0 = clip_words[i]["e"] - t_base
        g1 = clip_words[i + 1]["s"] - t_base
        gap = g1 - g0
        if gap > max_pause:
            # Excise middle of the pause, keeping half of keep_pause on each side so plosives aren't clipped
            pad_half = keep_pause * 0.5
            c0 = max(0.0, g0 + pad_half)
            c1 = max(c0, g1 - pad_half)
            if c1 - c0 > 0.02:
                cuts.append((c0, c1))

    if not cuts:
        return clip_bytes, clip_words

    # Splice PCM buffer around excised intervals with short 6 ms crossfade to avoid clicks
    n_samples = len(clip_bytes) // 2
    samples = list(struct.unpack(f"<{n_samples}h", clip_bytes))
    out_samples = []
    xf = int(0.006 * SR)
    cursor = 0
    for c0, c1 in cuts:
        i0 = max(cursor, min(n_samples, int(round(c0 * SR))))
        i1 = max(i0, min(n_samples, int(round(c1 * SR))))
        seg = samples[cursor:i0]
        if out_samples and seg and xf > 0:
            n_xf = min(xf, len(out_samples), len(seg))
            for k in range(n_xf):
                alpha = k / max(1, n_xf)
                out_samples[-n_xf + k] = int(round(out_samples[-n_xf + k] * (1.0 - alpha) + seg[k] * alpha))
            out_samples.extend(seg[n_xf:])
        else:
            out_samples.extend(seg)
        cursor = i1
    out_samples.extend(samples[cursor:])
    new_bytes = struct.pack(f"<{len(out_samples)}h", *out_samples)

    # Shift word timestamps by cumulative excised duration before each word
    remapped = []
    for w in clip_words:
        rel_s = w["s"] - t_base
        rel_e = w["e"] - t_base
        shift_s = sum(c1 - c0 for c0, c1 in cuts if c1 <= rel_s + 1e-4)
        shift_e = sum(c1 - c0 for c0, c1 in cuts if c1 <= rel_e + 1e-4)
        item = dict(w)
        item["s"] = round(t_base + rel_s - shift_s, 3)
        item["e"] = round(t_base + rel_e - shift_e, 3)
        remapped.append(item)

    return new_bytes, remapped


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--script", required=True, help="SCRIPT.md with [SPEAKER] or [SPEAKER:fx] lines")
    ap.add_argument("--out-dir", required=True, help="writes voice.wav + words.json here")
    ap.add_argument("--model", default=os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"))
    ap.add_argument("--output-format", default="mp3_44100_128")
    ap.add_argument("--gap", type=float, default=0.08, help="tight silence between lines (s, default 0.08)")
    ap.add_argument("--pad", type=float, default=0.035, help="kept before first / after last aligned char (s)")
    ap.add_argument("--max-pause", type=float, default=0.18,
                    help="trim internal dead-air / breath pauses longer than this (s; 0 disables)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing voice.wav")
    ap.add_argument("--tempo", type=float, default=float(os.environ.get("ELEVENLABS_TEMPO", "1.0")),
                    help="pitch-preserving speed-up (ffmpeg atempo) to hit brisk 165-180 WPM cadence")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    lines = parse_script(args.script)
    if not lines:
        sys.exit(f"[tts] No [SPEAKER] lines found in {args.script}")
    wav_path, words_path = os.path.join(args.out_dir, "voice.wav"), os.path.join(args.out_dir, "words.json")
    if os.path.exists(wav_path) and not args.force and not args.dry_run:
        print(f"[tts] {wav_path} exists; keeping it (use --force to regenerate).")
        return

    missing = sorted({sp for sp, _, _ in lines if not voice_for(sp)})
    n_words = sum(len(t.split()) for _, _, t in lines)
    est_sec_172 = n_words / (172.0 / 60.0)
    print(
        f"[tts] {len(lines)} lines, {n_words} words (~{est_sec_172:.1f} s at 172 WPM target), "
        f"model={args.model}, tempo={args.tempo}, max_pause={args.max_pause}s"
    )
    if args.dry_run:
        for sp, fx, t in lines:
            tag = f"{sp}:{fx}" if fx else sp
            print(f"  [{tag}] voice={voice_for(sp) or 'UNSET'} :: {t}")
        return
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        sys.exit("[tts] ELEVENLABS_API_KEY is not set.")
    if missing:
        sys.exit(f"[tts] No voice for speakers {missing}: set ELEVENLABS_VOICE_ID (or ELEVENLABS_VOICE_ID_<SPEAKER>).")

    suffix = ".mp3" if args.output_format.startswith("mp3") else ".pcm" if args.output_format.startswith("pcm") else ".bin"
    if suffix == ".pcm":
        os.environ["_EL_PCM_RATE"] = args.output_format.split("_")[1]
    os.makedirs(args.out_dir, exist_ok=True)
    # Raw API responses are cached per (text, voice, model, format), so re-timing (--tempo/--gap/--max-pause) never re-bills the API.
    cache_dir = os.path.join(args.out_dir, ".tts_cache")
    os.makedirs(cache_dir, exist_ok=True)
    pcm, words, t = bytearray(), [], 0.0
    gap = b"\x00\x00" * int(round(args.gap * SR))
    for i, (sp, fx, text) in enumerate(lines, 1):
        vid = voice_for(sp)
        key = hashlib.sha1(json.dumps([text, vid, args.model, args.output_format]).encode()).hexdigest()[:16]
        cpath = os.path.join(cache_dir, f"{key}.json")
        if os.path.exists(cpath):
            res = json.load(open(cpath, encoding="utf-8"))
        else:
            res = synth(text, vid, api_key, args.model, args.output_format)
            json.dump(res, open(cpath, "w", encoding="utf-8"))
        al = res.get("alignment") or res.get("normalized_alignment")
        if al and abs(args.tempo - 1.0) > 1e-3:
            al = dict(al)
            for k in ("character_start_times_seconds", "character_end_times_seconds"):
                al[k] = [x / args.tempo for x in al[k]]
        samples = to_pcm48k(base64.b64decode(res["audio_base64"]), suffix, args.tempo)
        dur = len(samples) / 2 / SR
        if al and al.get("character_start_times_seconds"):
            nz = [k for k, c in enumerate(al["characters"]) if not c.isspace()]
            a = max(0.0, al["character_start_times_seconds"][nz[0]] - args.pad)
            b = min(dur, al["character_end_times_seconds"][nz[-1]] + args.pad)
        else:
            a, b = 0.0, dur
        clip = samples[int(a * SR) * 2:int(b * SR) * 2]
        clip_words = words_from_alignment(al, sp, fx, t, a) if al else []
        if args.max_pause > 0 and clip_words:
            clip, clip_words = trim_dead_air(clip, clip_words, t, max_pause=args.max_pause)
        words += clip_words
        pcm += clip
        t += len(clip) / 2 / SR
        if i < len(lines):
            pcm += gap
            t += args.gap
        tag = f"{sp}:{fx}" if fx else sp
        print(f"[tts] {i:>2}/{len(lines)} [{tag}] {len(clip) / 2 / SR:5.2f}s  {text[:60]}")

    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(pcm))
    json.dump(words, open(words_path, "w", encoding="utf-8"), indent=1)
    wpm = (len(words) / max(t, 0.1)) * 60.0
    cadence_note = (
        "IN TARGET (165-180 WPM)"
        if TARGET_WPM_LO <= wpm <= TARGET_WPM_HI
        else f"TIP: try --tempo {172.0 / max(wpm, 1.0):.2f} to land in 165-180 WPM"
    )
    print(f"[tts] Wrote {wav_path} ({t:.2f} s, {SR} Hz mono) + {words_path} ({len(words)} words, {wpm:.1f} WPM — {cadence_note})")


if __name__ == "__main__":
    main()
