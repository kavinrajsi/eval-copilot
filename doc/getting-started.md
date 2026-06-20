# Getting Started — A New User's Guide

Eval Copilot answers one question about an AI feature: **is it actually good, or does it just happen to run?** You write down known-good answers *first*, define what "good" means, run the AI's outputs against them, and see exactly what passed, failed, or needs a human eye — then compare runs to prove a fix helped.

**The mental model in one line:**
**Golden set (truth) → Rubric (what the computer checks) → Run (grade outputs) → Results (a human confirms the fuzzy ones) → Compare (did the fix help?).**

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

> New here? Every account starts with a sample feature, **Brand Rulebook Checker** — a classifier with five golden cases and a rubric already filled in. Open it to see how a feature is shaped, then do a couple of runs to try **Compare**.

## Step 2 — Create a feature

1. Click **New feature**.
2. Enter a **name** (e.g. "Brand Rulebook Classifier") and an optional **type** (e.g. classifier).
3. The feature appears in the sidebar and table. Open it to reach the 5-tab workspace: **Golden Set · Rubric · Run · Results · Compare**.

## Step 3 — Build the Golden Set *(before you run anything)*

In the **Golden Set** tab:

1. For each case, enter the **Input / brief** and the **Known-good answer** (what a correct output looks like).
2. Click **Add case**. Aim for ~5 cases that cover your real failure risks, not just easy wins.
3. Use **Delete** to remove a case that's wrong.

> This is the answer key. Writing it *before* you see any output is what keeps the eval honest — you can't grade against a target you invented after the fact.

## Step 4 — Write the Rubric (what the computer checks)

In the **Rubric** tab:

1. Write a **plain-English rule** describing the standard you're holding the output to.
2. Add **machine rules** — choose a type, fill the value, click **Add rule**:

   | Rule type | Checks |
   | --- | --- |
   | `max_length` / `min_length` | character-count limits |
   | `must_contain` / `must_not_contain` | required or banned text (e.g. ban "IGI-Graded") |
   | `exact_match` | output must equal the known-good |
   | `count_equals` | a token must appear exactly N times (e.g. "stone" × 20) |

3. Pick a **Fuzzy-case grader** (the dropdown below the rules) — it decides how cases with *no* machine rule are handled:
   - **AI suggests, human decides** — the AI flags a possible issue; the verdict stays pending until a human confirms it.
   - **AI judges pass/fail** — the AI scores each fuzzy case pass/fail itself; a human can still override it in Results.
4. Click **Save rubric**. (Invalid rule shapes are rejected, so you can't save a half-filled rule.)

> **No machine rules?** That's fine — those cases become *fuzzy* and follow the **Fuzzy-case grader** you picked. Either way the AI uses Claude when `ANTHROPIC_API_KEY` is set (otherwise a built-in heuristic), and a human always has the final say via the override in Results.

## Step 5 — Run the feature

In the **Run** tab:

1. Optionally label the run (e.g. "v1 — before fix").
2. Paste your AI feature's **actual output** for each case.
3. Click **Grade run**. You'll get a summary — **X pass / Y fail / Z needs review** — and a per-case verdict table.
   - With machine rules → each case is graded **by rule** instantly.
   - Without rules, **AI judges pass/fail** mode → each case comes back with a real pass/fail (the AI's first-pass verdict, overridable).
   - Without rules, **AI suggests** mode → cases come back **"Needs review"** with an AI hint for a human to confirm.

## Step 6 — Review & confirm (Results)

In the **Results** tab:

1. Pick a run from the dropdown.
2. Each row shows the verdict, **who decided it** (`rule` / `llm_judge` / `llm_suggested` / `human`), and a note.
3. For "Needs review" cases — or any rule call you disagree with — click **Pass** or **Fail** to set the human verdict (it becomes `decided_by: human`).
4. **Delete run** here if you want to redo it.

## Step 7 — Fix, re-run, and Compare

1. Improve your AI feature, then do another run (e.g. "v2 — after fix") in the Run tab.
2. In the **Compare** tab, pick **Run 1** and **Run 2** → **Compare**.
3. See, case by case, what got **fixed** (fail → pass), what **broke** (pass → fail), and what stayed the same — the real proof your change helped instead of just moving the problem.

## Step 8 — Trust the grader *(optional, for builders)*

From the project root:

```bash
npm run verify
```

This replays the grading engine against cases with known verdicts to prove it still reproduces answers you already trust — "who checks the checker?"

---

## Quick reference

| You want to… | Go to | Action |
| --- | --- | --- |
| Add a feature to evaluate | Sidebar | **New feature** |
| Record what "good" looks like | Golden Set tab | **Add case** |
| Define grading rules | Rubric tab | add rules → **Save rubric** |
| Grade outputs | Run tab | paste outputs → **Grade run** |
| Confirm fuzzy verdicts | Results tab | **Pass** / **Fail** |
| Prove a fix worked | Compare tab | pick two runs → **Compare** |
