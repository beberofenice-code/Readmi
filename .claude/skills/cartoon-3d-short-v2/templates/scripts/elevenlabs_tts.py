#!/usr/bin/env python3
# ElevenLabs voiceover for Shorts-Studio: SCRIPT.md -> voice/<slug>/voice.wav (48 kHz mono s16) + words.json.
#
# Reads every "[SPEAKER] line" from SCRIPT.md, synthesises each line with
#   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps
# trims each clip to its aligned speech (+ small pads), joins clips with a short gap, converts with ffmpeg to
# 48000 Hz mono PCM, and groups `character_start_times_seconds` / `character_end_times_seconds` into word timings:
#   [{"w": "He", "s": 0.04, "e": 0.18, "speaker": "narrator"}, ...]  (seconds on the voice.wav timeline)
#
# Env:
#   ELEVENLABS_API_KEY            required (sent as xi-api-key)
#   ELEVENLABS_VOICE_ID           default voice for every speaker
#   ELEVENLABS_VOICE_ID_<SPEAKER> optional per-speaker override, e.g. ELEVENLABS_VOICE_ID_AGENT
#   ELEVENLABS_MODEL_ID           optional, default eleven_multilingual_v2
#
# Usage:
#   python3 scripts/elevenlabs_tts.py --script src/videos/dashcam/SCRIPT.md --out-dir voice/dashcam
#   python3 scripts/elevenlabs_tts.py --script ... --dry-run     # parse + show plan, no API calls
# Stdlib only (urllib, wave, json); needs ffmpeg on PATH.
import argparse, base64, json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request, wave

API = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
SR = 48000
LINE_RE = re.compile(r"^\s*\[([A-Za-z][A-Za-z0-9_ -]*)\]\s*(.+?)\s*$")


def parse_script(path):
    lines = []
    for raw in open(path, encoding="utf-8"):
        m = LINE_RE.match(raw)
        if not m:
            continue
        speaker, text = m.group(1).strip(), m.group(2).strip()
        if len(text) >= 2 and text[0] == text[-1] == '"':  # [AGENT] "quoted dialogue"
            text = text[1:-1].strip()
        if text:
            lines.append((speaker.lower(), text))
    return lines


def voice_for(speaker):
    key = "ELEVENLABS_VOICE_ID_" + re.sub(r"[^A-Z0-9]", "_", speaker.upper())
    return os.environ.get(key) or os.environ.get("ELEVENLABS_VOICE_ID")


def synth(text, voice_id, api_key, model_id, output_format, retries=3):
    body = json.dumps({"text": text, "model_id": model_id}).encode()
    url = API.format(voice_id=voice_id) + "?output_format=" + output_format
    for attempt in range(1, retries + 1):
        req = urllib.request.Request(url, data=body, method="POST",
                                     headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"})
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


def to_pcm48k(audio_bytes, suffix):
    """Decode ElevenLabs audio with ffmpeg -> 48 kHz mono s16le samples (bytes)."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        src = f.name
    try:
        if suffix == ".pcm":  # raw pcm_<rate> output formats
            rate = int(os.environ.get("_EL_PCM_RATE", "44100"))
            cmd = ["ffmpeg", "-v", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", src]
        else:
            cmd = ["ffmpeg", "-v", "error", "-i", src]
        cmd += ["-ac", "1", "-ar", str(SR), "-f", "s16le", "-acodec", "pcm_s16le", "-"]
        return subprocess.run(cmd, capture_output=True, check=True).stdout
    finally:
        os.unlink(src)


def words_from_alignment(al, speaker, t0, clip_start):
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
        res.append({"w": w, "s": round(t0 + a - clip_start, 3), "e": round(t0 + b - clip_start, 3), "speaker": speaker})
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--script", required=True, help="SCRIPT.md with [SPEAKER] lines")
    ap.add_argument("--out-dir", required=True, help="writes voice.wav + words.json here")
    ap.add_argument("--model", default=os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"))
    ap.add_argument("--output-format", default="mp3_44100_128")
    ap.add_argument("--gap", type=float, default=0.10, help="silence between lines (s)")
    ap.add_argument("--pad", type=float, default=0.04, help="kept before first / after last aligned char (s)")
    ap.add_argument("--force", action="store_true", help="overwrite an existing voice.wav")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    lines = parse_script(args.script)
    if not lines:
        sys.exit(f"[tts] No [SPEAKER] lines found in {args.script}")
    wav_path, words_path = os.path.join(args.out_dir, "voice.wav"), os.path.join(args.out_dir, "words.json")
    if os.path.exists(wav_path) and not args.force and not args.dry_run:
        print(f"[tts] {wav_path} exists; keeping it (use --force to regenerate).")
        return

    missing = sorted({sp for sp, _ in lines if not voice_for(sp)})
    n_words = sum(len(t.split()) for _, t in lines)
    print(f"[tts] {len(lines)} lines, {n_words} words (~{n_words / 3.7:.1f} s at 3.7 w/s), model={args.model}")
    if args.dry_run:
        for sp, t in lines:
            print(f"  [{sp}] voice={voice_for(sp) or 'UNSET'} :: {t}")
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
    pcm, words, t = bytearray(), [], 0.0
    gap = b"\x00\x00" * int(round(args.gap * SR))
    for i, (sp, text) in enumerate(lines, 1):
        res = synth(text, voice_for(sp), api_key, args.model, args.output_format)
        al = res.get("alignment") or res.get("normalized_alignment")
        samples = to_pcm48k(base64.b64decode(res["audio_base64"]), suffix)
        dur = len(samples) / 2 / SR
        if al and al.get("character_start_times_seconds"):
            nz = [k for k, c in enumerate(al["characters"]) if not c.isspace()]
            a = max(0.0, al["character_start_times_seconds"][nz[0]] - args.pad)
            b = min(dur, al["character_end_times_seconds"][nz[-1]] + args.pad)
        else:
            a, b = 0.0, dur
        clip = samples[int(a * SR) * 2:int(b * SR) * 2]
        if al:
            words += words_from_alignment(al, sp, t, a)
        pcm += clip
        t += len(clip) / 2 / SR
        if i < len(lines):
            pcm += gap
            t += args.gap
        print(f"[tts] {i:>2}/{len(lines)} [{sp}] {len(clip) / 2 / SR:5.2f}s  {text[:60]}")

    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(pcm))
    json.dump(words, open(words_path, "w", encoding="utf-8"), indent=1)
    print(f"[tts] Wrote {wav_path} ({t:.2f} s, {SR} Hz mono) + {words_path} ({len(words)} words)")


if __name__ == "__main__":
    main()
