# Move 5: Put It In Front of People

> **Two builders run their own feature through the tool — one cold. The grade is the real behaviour change: a failure the tool surfaced, a fix they made, a re-run that proves it. Compliments don't count; behaviour does.**

## The Build (plumbing the moves run on)

| Layer | Tech | Where |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router) + shadcn/ui | `src/app/dashboard/**` |
| API | Next.js route handlers | `src/app/api/**` |
| Grading engine | Plain JS (rules + suggest-only AI) | `src/lib/grading.js` |
| Database | Supabase Postgres + RLS | Supabase project (Postgres + RLS) |
| Auth | Supabase Auth (cookie sessions) | `src/lib/supabase/**`, `src/middleware.js` |

Screens: **My Features → Golden Set → Rubric → Run → Results → Compare**, all under the auth-guarded `/dashboard`.

## Verify the Verifier (run before trusting it)

Before grading any new case, the tool reproduces verdicts already known to be true — `npm run verify` runs the real engine against the Move 1 cases:

| Known case | Expected | Tool returns |
| --- | --- | --- |
| Maha #1 (correct solitaire) | PASS | pass |
| Maha #2 (17 stones, not 20) | FAIL | fail (count 17 ≠ 20) |
| Manoj #1 (62-char meta title) | FAIL | fail (over 60) |
| Manoj #5 (invented "IGI-Graded") | FAIL | fail (banned term) |

✅ Passing today. If it can't get these right, it can't be trusted on unseen cases.

## Testing

### User Testing (UAT) — the Move 5 gate

| Builder | Failure the tool surfaced | Change they made | Re-run result | Real behaviour change? |
| --- | --- | --- | --- | --- |
| _(real)_ | _fill live_ | _fill live_ | _fill live_ | _Yes/No_ |
| _(cold)_ | _fill live_ | _fill live_ | _fill live_ | _Yes/No_ |

**The surprise (one place reality broke the Move 2 bet):** _fill in after the sessions._

### QA / Functional

| # | Test | Expected | Pass? |
| --- | --- | --- | --- |
| Q1 | Create a feature | appears in My Features | _ |
| Q2 | Add 5 golden cases | all saved with known-good | _ |
| Q3 | Save rubric with rules | stored as jsonb | _ |
| Q4 | Run with 5 outputs | 5 grades created | _ |
| Q5 | Over-limit output | graded FAIL by rule | _ |
| Q6 | Banned word present | graded FAIL by rule | _ |
| Q7 | Compare run1 vs run2 | shows fail→pass diff | _ |
| Q8 | Verify-the-verifier set | all known verdicts reproduced | ✅ (`npm run verify`) |

### Security

Row Level Security isolates every builder's data per user — see [domain-model.md](./domain-model.md).

| # | Test | Expected | Pass? |
| --- | --- | --- | --- |
| S3 | Unauthenticated API call | rejected / empty | _ |
| S5 | SQL/text injection in input field | stored as data, not executed | _ (parameterised by supabase-js) |

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
- [x] API: features / cases / rubric / runs / compare / grades
- [x] Grading engine (rules + AI-suggest-only)
- [x] Frontend through Results + Compare
- [x] Verify-the-verifier passes (`npm run verify`)
- [ ] Two real builders run it (one cold) → before/change/after captured
- [ ] The surprise written down
- [ ] Final commit + submit
