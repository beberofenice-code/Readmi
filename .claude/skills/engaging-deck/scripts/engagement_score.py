#!/usr/bin/env python3
"""Score an engaging-deck outline.json for audience engagement (0-100).

Usage: python3 engagement_score.py path/to/outline.json [--json]
Exit code 0 if score >= 80, else 1.
"""
import json
import re
import sys

TAGS = {
    "cold-open-question": {"hook"}, "shock-stat": {"hook", "interrupt"},
    "story-moment": {"hook"}, "myth-buster": {"hook", "reveal"},
    "show-the-ending": {"hook"},
    "assertion-evidence": {"proof"}, "hero-number": {"interrupt", "proof"},
    "before-after-morph": {"reveal", "interrupt"}, "zoom-in-morph": {"reveal"},
    "progressive-reveal": {"reveal"}, "full-bleed-image": {"interrupt"},
    "comparison-split": {"proof"}, "three-takeaways": {"proof"},
    "quote-card": {"interrupt"}, "villain": {"proof"},
    "poll-hands": {"interaction", "interrupt"},
    "predict-then-reveal": {"interaction", "reveal"},
    "quiz-card": {"interaction"}, "turn-to-neighbour": {"interaction"},
    "qr-live": {"interaction"},
    "callback": {"close"}, "single-ask": {"close"}, "recap-three": {"close"},
}
INTERRUPTING = {"interrupt", "interaction", "reveal", "hook"}
TOPIC_WORDS = {"overview", "agenda", "introduction", "results", "analysis",
               "summary", "background", "conclusion", "about", "contents",
               "thank", "questions", "q&a", "outline", "update"}
BODY_BUDGET = {"live": 12, "classroom": 25, "read-alone": 40}
VERBISH = re.compile(r"\b(is|are|was|were|will|can|did|does|do|has|have|had|"
                     r"\w+(ed|es|s)|kept|lost|won|drives|grew|fell|beat|need|"
                     r"approve|let's|guess|where|why|how|what|who)\b", re.I)
BIG_NUMBER = re.compile(r"\b\d[\d,.]*\s*(k|m|b|million|billion|%|percent)?\b", re.I)
HUMAN_SCALE = re.compile(r"\b(every|like|a full|size of|enough to|as many as|"
                         r"equal to|that's|per person|each)\b", re.I)


def words(s):
    return len(re.findall(r"[\w'%]+", s or ""))


def score(outline):
    slides = outline.get("slides", [])
    fmt = outline.get("format", "live")
    budget = BODY_BUDGET.get(fmt, 12)
    issues, pts = [], 100
    n = len(slides)
    if not slides:
        return 0, ["outline has no slides"]

    def ded(p, msg):
        nonlocal pts
        pts -= p
        issues.append(f"-{p:>2}  {msg}")

    tags = [TAGS.get(s.get("pattern", ""), set()) for s in slides]

    # Hook
    if not any("hook" in t for t in tags[:2]):
        ded(15, "No hook pattern in slides 1-2 (use cold-open-question, shock-stat, story-moment...)")
    first = (slides[0].get("headline") or "").lower()
    if any(w in first.split() for w in ("agenda", "about", "contents", "overview")):
        ded(10, "Slide 1 is an agenda/about slide - move it later or cut it")

    # Big idea
    bi = outline.get("big_idea", "")
    if not bi or words(bi) > 15:
        ded(5, "big_idea missing or longer than 15 words")

    # Headlines
    for s, t in zip(slides, tags):
        h = s.get("headline", "")
        wc = words(h)
        low = set(re.findall(r"[a-z&']+", h.lower()))
        if wc > 10:
            ded(2, f"Slide {s.get('n')}: headline {wc} words (> 10)")
        if wc <= 3 and low & TOPIC_WORDS:
            ded(3, f"Slide {s.get('n')}: topic headline '{h}' - write an assertion")
        elif wc >= 3 and not VERBISH.search(h) and "hook" not in t:
            ded(1, f"Slide {s.get('n')}: headline may not be an assertion (no verb): '{h}'")
        bw = words(s.get("body", ""))
        if bw > budget:
            ded(3, f"Slide {s.get('n')}: body {bw} words > {budget} budget for '{fmt}'")
        if not s.get("notes"):
            ded(2, f"Slide {s.get('n')}: missing speaker notes")
        elif "[" not in s["notes"]:
            ded(1, f"Slide {s.get('n')}: notes have no [stage direction]")
        text = f"{h} {s.get('body', '')}"
        if BIG_NUMBER.search(text) and re.search(r"\d{3,}|\d+\s*(m|b|million|billion)\b", text, re.I) \
                and not HUMAN_SCALE.search(text) and not t & {"hook", "close"}:
            ded(1, f"Slide {s.get('n')}: big number without a human-scale comparison")

    # Pattern-interrupt cadence
    run = 0
    for s, t in zip(slides, tags):
        if t & INTERRUPTING or s.get("interaction") or s.get("motion") == "morph":
            run = 0
        else:
            run += 1
            if run == 6:
                ded(8, f"6 flat slides in a row ending at slide {s.get('n')} - add an interrupt")

    # Interaction
    inter = sum(1 for s, t in zip(slides, tags) if "interaction" in t or s.get("interaction"))
    need = max(1, n // 5) if fmt in ("live", "classroom") else (1 if n >= 6 else 0)
    if inter < need:
        ded(10, f"Only {inter} interaction(s); want >= {need} for {n} slides ({fmt})")

    # Reveal
    if n >= 6 and not any("reveal" in t for t in tags):
        ded(5, "No reveal moment (before-after-morph, predict-then-reveal, progressive-reveal)")

    # Motion overuse
    moving = sum(1 for s in slides if s.get("motion") not in (None, "", "none", "fade"))
    if n and moving / n > 0.4:
        ded(8, f"Motion on {moving}/{n} slides (> 40%) - keep it for reveals")

    # Close
    if "close" not in tags[-1]:
        ded(8, "Last slide is not a close pattern (callback / single-ask / recap-three)")
    if re.search(r"thank|questions\??$", (slides[-1].get("headline") or "").lower()):
        ded(6, "Ends on 'Thank you / Questions' - end on the ask")
    if not any("callback" == s.get("pattern") for s in slides[-3:]):
        ded(3, "No callback to the opening in the last 3 slides")

    # Slide budget
    mins = outline.get("minutes")
    if mins and fmt == "live" and n > mins * 2:
        ded(5, f"{n} slides for {mins} min live talk - likely rushed (target <= {int(mins * 1.5)})")

    return max(0, pts), issues


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        outline = json.load(f)
    pts, issues = score(outline)
    if "--json" in sys.argv:
        print(json.dumps({"score": pts, "issues": issues}, indent=2))
    else:
        grade = "ENGAGING" if pts >= 80 else ("OK" if pts >= 60 else "FLAT")
        print(f"Engagement score: {pts}/100  [{grade}]  ({len(outline.get('slides', []))} slides)")
        for i in issues:
            print("  " + i)
        if not issues:
            print("  No issues found.")
    return 0 if pts >= 80 else 1


if __name__ == "__main__":
    sys.exit(main())
