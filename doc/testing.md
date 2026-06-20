# Move 5: Put It In Front of People

> **Two builders run their own feature through the tool — one cold. The grade is the real behaviour change: a failure the tool surfaced, a fix they made, a re-run that proves it. Compliments don't count; behaviour does.**

## The Build (plumbing the moves run on)

| Layer | Tech | Where |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router) + shadcn/ui | `src/app/dashboard/**` |
| API | Next.js route handlers | `src/app/api/**` |
| Grading engine | JS rules + similarity + AI suggest / judge / multi-criteria / vision | `src/lib/grading.js`, `src/lib/grading-claude.js` |
| Database | Supabase Postgres + RLS (schema vendored in `supabase/migrations/`) | Supabase project (Postgres + RLS) |
| Auth | Supabase Auth (cookie sessions) | `src/lib/supabase/**`, `src/proxy.js` |

Screens: **My Features →** per feature **Knowledge → Golden Set → Rubric → Run → Results → Compare → Quick test**, all under the auth-guarded `/dashboard`.

## Verify the Verifier (run before trusting it)

Before grading any new case, the tool reproduces verdicts already known to be true — `npm run verify` runs the real engine against the Move 1 cases:

| Known case | Expected | Tool returns |
| --- | --- | --- |
| Maha #1 (correct solitaire) | PASS | pass |
| Maha #2 (17 stones, not 20) | FAIL | fail (count 17 ≠ 20) |
| Manoj #1 (62-char meta title) | FAIL | fail (over 60) |
| Manoj #1b (40-char known-good title) | PASS | pass |
| Manoj #5 (invented "IGI-Graded") | FAIL | fail (banned term) |

✅ Passing today. If it can't get these right, it can't be trusted on unseen cases.

## Testing

### User Testing (UAT) — the Move 5 gate

> ⚠️ **SIMULATION — not real human UAT.** No two real builders were available, so the
> two sessions below role-play Move 1 builders (Maha, Manoj). The **verdicts are real**
> engine output (`node scripts/uat-simulation.mjs`, run 2026-06-20); the **humans are
> simulated**. The real "two real builders, one cold" gate therefore stays OPEN — see the
> Submit Checklist. This stands in as a dogfood until live sessions happen.

**Session dates:** 2026-06-20 (both, simulated)

| Builder | Failure the tool surfaced | Change they made | Re-run result | Real behaviour change? |
| --- | --- | --- | --- | --- |
| Maha (warm, simulated) — Jewellery Image Generator | Generator silently rendered a **rose-gold** band on a piece that must be yellow gold (case 1, `Missing required term "yellow gold"`); plus a "distorted" clasp artifact (case 3) | Re-prompted to lock metal = yellow gold and reject render artifacts | v1 2/5 → **v2 5/5**, 3 cases fail→pass | Yes (simulated) — metal substitution was new and would have shipped |
| Manoj (cold, simulated) — SEO Content Generator | Model invented an **"IGI-Graded"** certification it has no basis for (case 3, banned term); two meta titles over the 60-char limit (62, 65) | Removed the fabricated cert claim, trimmed titles to ≤60 | v1 2/5 → **v2 5/5**, 3 cases fail→pass | Yes (simulated) — the invented cert body was new and would have shipped |

**The surprise (one place reality broke the Move 2 bet):** The Move 2 bet assumes a builder
reasons **case by case**, but the tool applies **one rubric to every case in a feature**
(`src/app/api/features/[id]/runs/route.js` reads the single latest rubric and grades all
outputs with it). So a case that needs its own rule — e.g. Maha's "exactly 20 stones" count
on one bracelet image — can't get it without forcing that rule onto all five cases. A real,
case-specific failure can therefore hide behind a feature-wide rubric. The instrument is
only as granular as its coarsest rule. _(Found while building the simulation, not in a live
session — flagged here so a real session can confirm it.)_

### QA / Functional

Q8 was executed (`npm run verify`). Q1–Q7 and Q9–Q12 were verified on 2026-06-20 by tracing the exact server code path that backs each flow (route handler → grading engine → DB write); cells note the file that carries the behaviour. A live click-through against a seeded Supabase project is the only thing these don't cover.

| # | Test | Expected | Pass? |
| --- | --- | --- | --- |
| Q1 | Create a feature | appears in My Features | ✅ `POST /api/features` |
| Q2 | Add 5 golden cases | all saved with known-good | ✅ `POST /api/features/[id]/golden-cases` |
| Q3 | Save rubric with rules | stored as jsonb | ✅ `rubric.rules` inserted as jsonb |
| Q4 | Run with 5 outputs | 5 grades created | ✅ runs route inserts one grade per output |
| Q5 | Over-limit output | graded FAIL by rule | ✅ `max_length` → `fail` in `grading.js` |
| Q6 | Banned word present | graded FAIL by rule | ✅ `must_not_contain` → `fail` |
| Q7 | Compare run1 vs run2 | shows fail→pass diff | ✅ compare route maps fail→pass to `fixed` |
| Q8 | Verify-the-verifier set | all known verdicts reproduced | ✅ (`npm run verify`) |
| Q9 | Run with a no-machine-rule rubric in **suggest** mode | grades stored pending (`Needs review`) with an `llm_suggested` AI hint | ✅ `verdict null` + `decided_by llm_suggested` |
| Q9b | Run with a no-machine-rule rubric in **judge** mode | grades get a real pass/fail with `decided_by` → `llm_judge` and a `[confidence] rationale` note | ✅ `judgeByLLM` path on `grader_mode === "judge"` |
| Q10 | Confirm/override a grade in Results | verdict set, `decided_by` → `human` | ✅ `PATCH /api/grades/[id]` sets `decided_by human` |
| Q11 | Save rubric with an invalid rule shape | rejected (400) | ✅ `validateRules` → `badRequest` (400) |
| Q12 | Delete a golden case / run | row and its grades removed | ✅ DELETE drops grades then the row |
| Q13 | Save a Knowledge doc | stored on `feature`, fed to the AI grader | ✅ `PATCH /api/features/[id]`; live AI cites it |
| Q14 | Similarity rule (`rouge_l` / `jaccard`) | FAIL below threshold vs known-good | ✅ unit-checked against `grading.js` |
| Q15 | Judge with criteria | per-criterion 0–100 + overall vs `pass_threshold` | ✅ live multi-criteria call (on-brand 81 pass / off-brand 0 fail) |
| Q16 | Quick test (text) | graded + logged to history | ✅ `POST /api/features/[id]/quick-test` inserts; GET lists |
| Q17 | Quick test (image) | vision judge verdict | ✅ image path → `judgeImageByLLM` |
| Q18 | Override → confusion matrix | machine vs human + Accuracy/Precision/Recall/F1 | ✅ `grade.auto_verdict` preserved; Results computes |
| Q19 | Stability check | % stable + score variance over N runs | ✅ live 5× run, 100% stable on a clear case |

### Security

Row Level Security isolates every builder's data per user — see [domain-model.md](./domain-model.md).

| # | Test | Expected | Pass? |
| --- | --- | --- | --- |
| S3 | Unauthenticated API call | rejected / empty | ✅ `requireUser` returns 401 on every route |
| S5 | SQL/text injection in input field | stored as data, not executed | ✅ parameterised by supabase-js |

## Dummy Worked Example (sample data, not for submission)

**Feature:** SEO Content Generator (mirrors Manoj). **Rubric rules:**
`[{ "type":"max_length","value":60 }, { "type":"must_not_contain","value":"IGI-Graded" }]`

**Run "v1 — before fix":**

| # | Input | Known-good | Actual output | Verdict | By | Note |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Meta title ≤60 | keyword, ≤60 | "Start Your Gold Savings Scheme Today and Save More Every Month" (62) | FAIL | rule | Over 60 chars (62) |
| 2 | Meta description ≤155 | keyword + CTA | "Invest in a gold savings scheme... Start today!" (93) | PASS | rule | — |
| 3 | Blog intro, no stuffing | natural keyword | keyword repeated 4× in 3 sentences | FAIL | human | AI flagged; human confirmed |
| 4 | Title tag "Keyword \| Brand" | correct format | "Gold Jewellery Collections \| Kalyan Jewellers" | PASS | rule | — |
| 5 | H1, verified certs only | no invented claims | "Shop BIS Hallmark & IGI-Graded Gold Jewellery" | FAIL | rule | Banned term "IGI-Graded" |

**v1: 2 pass / 3 fail.** Builder removes "IGI-Graded", trims the title, rewrites the intro.

**Run "v2 — after fix":** cases 1, 3, 5 go **fail → pass.** The tool surfaced 3 real failures; the builder fixed all 3. That before → change → after is the evidence the grade is built on.

## Submit Checklist

- [x] Auth (login) working
- [x] API: features (+knowledge) / cases / rubric / runs / compare / grades / quick-test / stability
- [x] Grading engine (rules + similarity + AI suggest / judge / multi-criteria / vision)
- [x] Frontend through Knowledge → Results + Compare + Quick test
- [x] Verify-the-verifier passes (`npm run verify`)
- [x] DB schema vendored to `supabase/migrations/`
- [ ] Two real builders run it (one cold) → before/change/after captured — **simulated only** (`scripts/uat-simulation.mjs`); real sessions still pending
- [x] The surprise written down (from the simulation; confirm in a live session)
- [ ] Final commit + submit
