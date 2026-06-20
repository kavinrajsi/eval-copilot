# Getting Started — A New User's Guide

Eval Copilot answers one question about an AI feature: **is it actually good, or does it just happen to run?** You give the grader context, write down known-good answers *first*, define what "good" means, run the AI's outputs against them, and see exactly what passed, failed, or needs a human eye — then compare runs to prove a fix helped.

**The mental model in one line:**
**Knowledge (context) → Golden set (truth) → Rubric (what the computer checks) → Run (grade outputs) → Results (a human confirms the fuzzy ones, see the false-pass matrix) → Compare (did the fix help?).** Plus **Quick test** for an ad-hoc check of any text or image.

---

## Step 0 — Sign in

1. Open the app (locally: `http://localhost:3000`). You'll land on **/login**.
2. **Create account** (email + password) or **Sign in**. If email confirmation is enabled, confirm via the email link first.
3. Forgot your password? Click **"Forgot your password?"** → enter your email → open the reset link → set a new one.

## Step 1 — Get your bearings (Dashboard)

After signing in you're on **/dashboard**:

- **Sidebar** — Dashboard, New feature, and your list of features.
- **KPI cards** — total features, golden cases, runs, and overall pass rate.
- **Chart** — pass rate per run over time.
- **Features table** — each feature with its case count, run count, and latest pass rate. Click a row to open it.

> New here? Every account starts with two sample features — **Brand Rulebook Checker** and **Madarth Brand Compliance** (the latter pre-loaded with a Knowledge doc and machine rules). Open one to see how a feature is shaped, then do a couple of runs to try **Compare**.

The feature workspace has seven tabs: **Knowledge · Golden Set · Rubric · Run · Results · Compare · Quick test**.

## Step 2 — Create a feature

1. Click **New feature**.
2. Enter a **name** and an optional **type**.
3. The feature appears in the sidebar and table. Open it to reach the workspace.

## Step 3 — Add Knowledge *(context for the AI grader)*

In the **Knowledge** tab (the first one, before the golden set):

1. Paste any **reference / source material** — brand guidelines, a style guide, domain rules.
2. Click **Save knowledge**.

> This is the reference the AI grader reads. It's injected into every AI grading prompt (suggest / judge / image), so grading reflects your full source material, not just the one-line rubric. **Machine rules ignore it** — they're pure text checks. Leave it empty if you don't need it.

## Step 4 — Build the Golden Set *(before you run anything)*

In the **Golden Set** tab:

1. For each case, enter the **Input / brief** and the **Known-good answer** (what a correct output looks like).
2. Click **Add case**. Aim for ~5 cases that cover your real failure risks, not just easy wins.
3. Use **Delete** to remove a case that's wrong.

> This is the answer key. Writing it *before* you see any output is what keeps the eval honest — you can't grade against a target you invented after the fact.

## Step 5 — Write the Rubric (what the computer checks)

In the **Rubric** tab:

1. Write a **plain-English rule** describing the standard you're holding the output to.
2. Add **machine rules** — choose a type, fill the value, click **Add rule**:

   | Rule type | Checks |
   | --- | --- |
   | `max_length` / `min_length` | character-count limits |
   | `must_contain` / `must_not_contain` | required or banned text (e.g. ban "IGI-Graded") |
   | `exact_match` | output must equal the known-good |
   | `count_equals` | a token must appear exactly N times (e.g. "stone" × 20) |
   | `rouge_l` / `jaccard` | output similarity to the known-good ≥ a threshold (0–1) |

3. Pick a **Fuzzy-case grader** (the dropdown below the rules) — it decides how cases with *no* machine rule are handled:
   - **AI suggests, human decides** — the AI flags a possible issue; the verdict stays pending until a human confirms it.
   - **AI judges pass/fail** — the AI scores each fuzzy case itself; a human can still override it in Results.
4. *(Judge mode, optional)* Add **scoring criteria** + a **pass threshold**. With criteria, the AI scores **each one 0–100** and an overall; the case passes when overall ≥ threshold. Leave criteria empty for a plain pass/fail judge.
5. Click **Save rubric**. (Invalid rule shapes are rejected, so you can't save a half-filled rule.)

> Either way the AI uses Claude when `ANTHROPIC_API_KEY` is set (otherwise a built-in heuristic), and a human always has the final say via the override in Results.

## Step 6 — Run the feature

In the **Run** tab:

1. Optionally label the run (e.g. "v1 — before fix").
2. Paste your AI feature's **actual output** for each case.
3. Click **Grade run**. You'll get a summary — **X pass / Y fail / Z needs review** — and a per-case verdict table.
   - With machine rules → each case is graded **by rule** instantly.
   - Judge mode → each case comes back with a real pass/fail (and, with criteria, an overall **NN/100** score), overridable.
   - Suggest mode → cases come back **"Needs review"** with an AI hint for a human to confirm.

## Step 7 — Review & confirm (Results)

In the **Results** tab:

1. Pick a run from the dropdown.
2. Each row shows the verdict (and score, if scored), **who decided it** (`rule` / `llm_judge` / `llm_suggested` / `human`), and a note.
3. For "Needs review" cases — or any call you disagree with — click **Pass** or **Fail** to set the human verdict (it becomes `decided_by: human`).
4. As you override, a **confusion matrix** appears: machine verdict vs your (human) verdict over reviewed cases, with the **false-pass** cell flagged and **Accuracy / Precision / Recall / F1** — so you can see where the grader itself is wrong, not just the feature.
5. **Delete run** here if you want to redo it.

## Step 8 — Fix, re-run, and Compare

1. Improve your AI feature, then do another run (e.g. "v2 — after fix") in the Run tab.
2. In the **Compare** tab, pick **Run 1** and **Run 2** → **Compare**.
3. See, case by case, what got **fixed** (fail → pass), what **broke** (pass → fail), and what stayed the same.

## Step 9 — Quick test *(ad-hoc, no golden case)*

In the **Quick test** tab:

1. Paste any **content**, or attach an **image** (PNG/JPEG/WebP/GIF), and click **Test content**. It's graded against the current rubric + knowledge and **saved to the history** below (nothing else is created — no run, no golden case).
2. **Check stability** runs the same input several times and reports how consistent the AI is (% stable + score variance) — reliability, not accuracy. Meaningful in judge mode; machine rules are deterministic.

> Images are always reviewed by the AI vision judge, since machine rules can't read pixels.

## Step 10 — Trust the grader *(optional, for builders)*

From the project root:

```bash
npm run verify          # replay the grader against known Move 1 verdicts
npm run brand:madarth   # run the Madarth brand rules over sample copy
npm run uat             # simulated before→fix→after through the real engine
```

`npm run verify` proves the engine still reproduces answers you already trust — "who checks the checker?"

---

## Quick reference

| You want to… | Go to | Action |
| --- | --- | --- |
| Add a feature to evaluate | Sidebar | **New feature** |
| Give the grader context | Knowledge tab | paste reference → **Save knowledge** |
| Record what "good" looks like | Golden Set tab | **Add case** |
| Define grading rules + criteria | Rubric tab | add rules / criteria → **Save rubric** |
| Grade outputs | Run tab | paste outputs → **Grade run** |
| Confirm verdicts & see false-pass rate | Results tab | **Pass** / **Fail** → confusion matrix |
| Prove a fix worked | Compare tab | pick two runs → **Compare** |
| Test any text or image, or check consistency | Quick test tab | **Test content** / **Check stability** |
