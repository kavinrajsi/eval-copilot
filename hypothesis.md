# Move 2: The Hypothesis

> **Written before building anything. This is the bet — locked in advance so the numbers can't be bent later to look right.**

## The Claim

If you give a builder a golden set and a rubric for their own AI feature, they will find a **real failure they did not already know about** — more often than not.

In plain words: builders think their AI works because it runs. Hand them an answer key they wrote *first*, and the tool will show them a mistake they were about to ship and never saw coming.

## What Counts as a "Real Find"

Not every failure counts. A failure only counts if it is **both**:

- **Would've shipped? = Yes** — the builder would have let this go live.
- **Already knew? = No** — it was new to them; they didn't know it was there.

A failure the builder already knew about does **not** count. That is the line between an **instrument** (finds what you're blind to) and a **mirror** (just repeats what you already believe).

## The Three Numbers

| Outcome | Result | What it means |
| --- | --- | --- |
| Right | 3 or 4 of 4 builders find a real, unknown, would-ship failure | The tool is an instrument. It works. |
| Mirror | 2 or fewer of 4 find anything new | The tool only confirms what builders already knew. Not useful. |
| Kill-number | 0 of 4 find an unknown failure | The hypothesis was wrong. *"I built a rubber stamp, not an eval."* |

The kill-number is real. If it hits 0 of 4, the honest move is to write that the idea failed — not to quietly change the target.

## The Evidence This Bet Is Built On

Move 1 tested this by hand against four real builders:

| Builder | Feature | Score | Real unknown failure found? |
| --- | --- | --- | --- |
| Maha | AI Jewellery Image Generator | 1 / 5 | Yes |
| Ananth | Multi-Channel Social Generation | 1 / 5 | Yes |
| Siddharth | Brand Rulebook Classifier | 3 / 5 | Yes |
| Manoj | SEO Content Generator | 2 / 5 | Yes |

**4 of 4** builders surfaced a real failure they would have shipped and did not know about. None of them had a written answer key before the session.

This is why the bet is set at "more often than not" — the by-hand test already cleared that bar.
