# Slide Pattern Library

Each pattern has tags used by the scorer: `hook`, `interrupt`, `interaction`,
`reveal`, `proof`, `close`. Use the pattern id verbatim in `outline.json`.

## Hooks (slide 1–2)

| id | tags | Recipe |
|---|---|---|
| `cold-open-question` | hook | One provocative question, full-bleed, no logo. Speaker pauses 3 s. |
| `shock-stat` | hook, interrupt | One giant number (≥ 200 pt) + 6-word meaning line. |
| `story-moment` | hook | "Last Tuesday at 3 AM…" — one photo, one sentence, a named person. |
| `myth-buster` | hook, reveal | State a belief the audience holds, then a big ✗. Truth comes later. |
| `show-the-ending` | hook | Show the result first ("This took 9 minutes"), then rewind. |

## Body

| id | tags | Recipe |
|---|---|---|
| `assertion-evidence` | proof | Assertion headline + ONE chart/image proving it. No bullets. |
| `hero-number` | interrupt, proof | Single metric, human-scale comparison underneath. |
| `before-after-morph` | reveal, interrupt | Two pages; Morph moves the same objects from state A → B. |
| `zoom-in-morph` | reveal | Page A shows the whole; page B scales into one detail via Morph. |
| `progressive-reveal` | reveal | Build one item per click; speaker controls pace. Max 4 items. |
| `full-bleed-image` | interrupt | Photo edge to edge, ≤ 6 words overlay on a scrim. |
| `comparison-split` | proof | Two columns, us vs them / old vs new, max 3 rows. |
| `three-takeaways` | proof | Three icons, three ≤ 4-word labels. Only once per deck. |
| `quote-card` | interrupt | Real quote, real name, photo. Pulls in social proof. |
| `villain` | proof | Name the problem as an enemy ("Spreadsheet hell"). Gives the story tension. |

## Interaction (every 3–5 slides in live/classroom formats)

| id | tags | Recipe |
|---|---|---|
| `poll-hands` | interaction, interrupt | "Hands up if…" — big question, two options. |
| `predict-then-reveal` | interaction, reveal | Ask the audience to guess a number; next slide (Morph) reveals it. |
| `quiz-card` | interaction | A/B/C/D options; answer revealed by click (build) or next slide. |
| `turn-to-neighbour` | interaction | 30-second pair discussion with a timer visual. |
| `qr-live` | interaction | QR to a live poll / form; keep the question on screen. |

For `read-alone` decks replace interactions with `predict-then-reveal` styled as
"Guess first, then look →" — the reader still has to commit.

## Close

| id | tags | Recipe |
|---|---|---|
| `callback` | close | Return to the slide-1 image/question, now answered. |
| `single-ask` | close | One verb, one action, one URL/QR. Nothing else on the slide. |
| `recap-three` | close | Three words that summarise the talk — must match the big idea. |

## Anti-patterns (scorer penalises)

- Agenda / table of contents / "About us" as slide 1–2
- Topic headlines ("Overview", "Results", "Q3 Analysis")
- > 5 bullets, or any bullet with > 12 words
- "Thank you / Questions?" as the final slide with no ask
- Motion on > 40 % of slides, or any decorative spin/bounce
