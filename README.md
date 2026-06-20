# Eval Copilot

> **A tool that tells a builder whether the AI inside their own app is actually good, or just happens to run.**

A submission for the **Code Path Hackathon**, [Track B: The Eval Co-pilot](#the-track).

A builder describes their AI feature and hands over a few example inputs. Eval Copilot helps them turn those into a **golden set** (inputs paired with what a good output looks like) and a **rubric** (the rule for grading any output), runs the feature against both, and returns the exact cases where it fails — the failures they were about to ship and didn't know about.

Not a benchmark. Not a dashboard of green checkmarks. A list of the places your own AI is wrong.

## Why this exists

"It works on the things I tried" is worthless as a signal. You chose those inputs because you already knew they'd pass — a signal you hand-selected to be positive is a mirror, not an instrument. An LLM will produce plausible output on anything, forever, so "it ran" stopped meaning "it is good" the moment a model went into the middle of the app.

The only thing that separates a good AI feature from a lucky one is its behavior on inputs you **did not** cherry-pick, graded against an answer you committed to **in advance**. That is what a golden set is. This tool makes "good" something you can see instead of something you hope for.

## The two ideas it's built around

- **Golden set** — a list of inputs where a human decided what a good output looks like, written down *before* the model runs. The answer key almost nobody has.
- **Rubric** — the rule that turns "is this output good?" into something you can apply the same way twice: the dimensions you grade on, and what passing means on each.

## Evaluation evidence

The [doc/](doc/) folder holds the **Move 1** evidence — being the eval by hand against real AI features that builders were shipping. Each report defines a pass condition, runs five known-good cases, grades actual vs. expected, and records whether the failure was one the builder *would have shipped*.

| Evaluator | Feature graded | Pass rate | Score | Most critical silent failure |
| --- | --- | --- | --- | --- |
| [Maha](./doc/user-1.md) | AI Jewellery Image Generator | 20% | **1 / 5** | Wrong stone count (20→17), melted filigree, rose→yellow gold |
| [Ananth](./doc/user-2.md) | Multi-Channel Social Generation | 20% | **1 / 5** | Discount mention when explicitly banned; X post over 280 chars |
| [Siddharth](./doc/user-3.md) | Brand Rulebook Classifier | 60% | **3 / 5** | False passes on colour and logo-size violations |
| [Manoj](./doc/user-4.md) | SEO Content Generator | 40% | **2 / 5** | Invented "IGI-Graded" certification claim |

See [doc/summary.md](./doc/summary.md) for the executive summary.

**What the evidence shows:**

- **Silent failures dominate.** Across all four evaluations, the failing cases would have shipped — every output looked production-ready at a glance.
- **False passes are the highest risk.** The rulebook classifier approved non-compliant assets as compliant — far more dangerous than a false fail, because nothing flags them downstream.
- **Invented claims create real exposure.** Fabricated certifications and prohibited messaging carry legal and brand risk beyond quality.
- **Constraint violations go undetected.** Character limits, length caps, and exact counts are breached with no warning to the user.

## The five moves

Track B walks the shared five-move spine. Each move ends in a deliverable.

| Move | What you do | Submit |
| --- | --- | --- |
| **1. Be the eval yourself, on two real apps** | Sit with 2 builders, force 5 known-good cases into existence, run their feature, grade by hand. | The raw record + whether they had any answer key before you sat down. → [doc/](doc/) |
| **2. Write down your bet, before you build** | Claim + 3 numbers + kill-number, as your first timestamped commit. | The timestamped hypothesis. → [hypothesis.md](./hypothesis.md) |
| **3. Decide what the computer checks, and what only a person can** | Draw the line between what a simple rule can check and what needs judgement; mark who makes the final call. | The diagram + the failure you accepted. → [who-checks-what.md](./who-checks-what.md) |
| **4. Draw the domain model** | Hand-draw the schema (feature → golden cases → rubric → run → grade), mark the run-to-run comparison keys, add row-level security + two-user test. | Hand-drawn schema + proof the two-user test passes. |
| **5. Put it in front of two people, report what really happened** | Two builders run their own feature through the tool (one cold); capture before-run → change → after-run. | The before/after evidence + the surprise. |

> **Who verifies the verifier?** The builder does — against cases they already have a verdict on. Before the rubric is trusted on an unseen case, it must flag the outputs already known to be bad and pass the ones already known to be fine.

## Repository structure

```text
.
├── README.md           This file
├── hypothesis.md       Move 2 — the timestamped bet (claim + 3 numbers + kill-number)
├── who-checks-what.md  Move 3 — what the computer checks vs. what a person checks
└── doc/
    ├── summary.md      Executive summary across all evaluations
    ├── user-1.md       Maha — AI Jewellery Image Generator
    ├── user-2.md       Ananth — Multi-Channel Social Generation
    ├── user-3.md       Siddharth — Brand Rulebook Classifier
    └── user-4.md       Manoj — SEO Content Generator
```

## The track

This project targets **Track B: The Eval Co-pilot** of the Code Path Hackathon — a 24-hour sprint built on one principle:

> Build the service. Earn the software. Verify the verifier.

The app is plumbing — it must run and the walls must hold, but there are no points for polish. The grade is the evidence that the tool surfaced a real failure a human then acted on. An honest disproof beats a polished fake.
