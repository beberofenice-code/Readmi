---
name: engaging-deck
description: >
  Turn any topic, document or rough outline into a HIGH-ENGAGEMENT presentation
  (PPT/PPTX/slide deck) — a story-driven deck with a hook in the first 10 seconds,
  one idea per slide, assertion headlines, hero numbers, Morph "reveal" moments,
  audience interaction every 3-5 slides, and stage-direction speaker notes.
  Use when the user asks for an engaging, captivating, viral, TED-style, pitch,
  keynote, classroom or workshop presentation, or says a deck is "boring" and
  needs more energy. Plans and scores the engagement layer, then hands rendering
  to the ppt-master skill (or the pptx skill if ppt-master is unavailable).
metadata:
  version: "1.0.0"
  renders_with: ppt-master
---

# Engaging Deck

Most decks fail on **attention**, not on looks. This skill owns the *engagement
layer* — what the audience feels, when, and why they keep watching — and then
hands a fully specified deck to a rendering skill. Do not draw slides here.

Work in four stages. Do not skip a stage; each produces a file in the project
folder (`decks/<slug>/`).

---

## Stage 1 — Engagement Brief (`brief.md`)

Answer these before writing a single slide. If the user did not say, infer
sensible defaults and state them in one line; ask only if the audience is
truly unknowable.

| Field | Question |
|---|---|
| Audience | Who is in the room, and what do they already believe? |
| Big Idea | The ONE sentence they should repeat afterwards (≤ 15 words, has a verb and a stake). |
| Shift | From *what they think now* → *what they'll think after*. |
| Format | Live talk / self-running / sent as file / classroom / pitch. Sets text density (see below). |
| Length | Minutes → slide budget ≈ minutes × 1.0–1.5 for live, × 0.7 for read-alone. |
| Ask | The single action at the end (sign up, approve, try, vote, remember X). |

Text density by format: **live** ≤ 12 words/slide body; **read-alone** ≤ 40;
**classroom** ≤ 25 plus a visual.

## Stage 2 — Story Spine (`outline.json`)

Pick ONE arc from [`references/story-arcs.md`](references/story-arcs.md)
(default: **Problem → Stakes → Turn → Proof → Ask**). Then fill the outline
using slide **patterns** from [`references/patterns.md`](references/patterns.md).

Write `outline.json` in exactly this shape (the scorer reads it):

```json
{
  "title": "…", "format": "live", "minutes": 10, "big_idea": "…",
  "slides": [
    {"n": 1, "pattern": "cold-open-question", "headline": "…",
     "body": "…", "visual": "…", "interaction": null,
     "motion": "none|fade|morph|build", "notes": "…"}
  ]
}
```

Hard rules:
1. **Hook in slide 1–2.** Never open with an agenda, logo or "About me".
   Use a pattern tagged `hook`.
2. **Headlines are assertions, not topics.** "Churn doubled after the price
   change" — not "Churn Analysis". ≤ 10 words.
3. **One idea per slide.** If a slide needs "and", split it.
4. **Pattern interrupt every 3–5 slides**: an `interaction`, a `reveal`, a
   hero number, a full-bleed image, or a tonal shift. Never 6 text slides in a row.
5. **Numbers get a human scale.** "1.2 M litres" → "an Olympic pool every week".
6. **Callback ending.** The final slide returns to the opening hook, then the Ask.
7. **Motion earns its place.** Use Morph for a reveal / zoom / before→after,
   `build` only where the speaker controls pace. Default `none`. No
   decorative spins, bounces or auto-building every slide.

## Stage 3 — Score & Revise

Run the scorer and fix everything it flags until the score is ≥ 80:

```bash
python3 "${SKILL_DIR}/scripts/engagement_score.py" decks/<slug>/outline.json
```

It checks hook placement, headline-as-assertion heuristics, word budgets,
pattern-interrupt cadence, interaction count, motion overuse, numbers without
human scale, and callback ending. It prints a 0–100 score with fixes. Show the
user the score line and the top fixes you applied, not the raw output.

## Stage 4 — Render

Hand off to **ppt-master** (installed at `.claude/skills/ppt-master`). Invoke
that skill and give it, as the content source:

- `brief.md` and the scored `outline.json`
- A visual style: suggest from ppt-master's `references/visual-styles/`
  by tone — energetic/young → `memphis`, `zine`, `pixel-art`; corporate
  /pitch → `swiss-minimal`, `editorial`, `data-journalism`; tech →
  `dark-tech`, `glassmorphism`, `blueprint`; teaching → `chalkboard`,
  `sketch-notes`, `soft-rounded`.
- The motion plan: slides marked `morph` are authored as **two consecutive
  pages** (before/after) and exported with Morph pairs; slides marked
  `build` get an `animations.json` entry; everything else `none`.
- Speaker notes from each slide's `notes` field (keep stage directions in
  `[brackets]`).

If ppt-master is unavailable, use the `pptx` skill with the same inputs.

After rendering, do a 5-second test on 3 random slides (render to image, look
once): can you state the slide's point in 5 seconds? If not, simplify it.

---

## Speaker Notes Style

Every slide's `notes` must contain: the line to *say* (not the headline read
aloud), one `[stage direction]` (pause, click, ask hands, walk), and the
transition sentence into the next slide. See the example in
[`examples/outline.example.json`](examples/outline.example.json).

## Deliverables Checklist

- [ ] `brief.md` — big idea, shift, ask
- [ ] `outline.json` — scored ≥ 80
- [ ] `.pptx` from the rendering skill, with notes and motion
- [ ] One-line summary to the user: big idea, arc, score, file path
