# Move 3: Who Checks What

> **Decide what the computer is allowed to grade, and what only a person can. Draw the line between the two, and mark exactly who makes the final call — before a single answer is graded.**

## The Diagram

![How a grade gets decided, in plain English](https://mermaid.ink/img/pako:eJxtklFr2zAQx7_Kn3tqYdnoaxgtju00YawtacYYVh4U-1xrkaUgyclCmu8-pIS1gz7e6fjd6Xd3pNo2TGNqtd3XnXQBy4kwAJBVgn4yOrljSANp_J4dWmd7hI6RzQWtMBrdYnIUlMcKeNVvNcMNmlF3XG-gwp2g0xk4idWvgn6xxwgHO6CWBrUdTIB16GWoO6gg6BV5JWg5K5E_fn_6sSwXyGdl_u0Z86Wg1f-0B4sRVIBhbjx-D80L92wSpagEZXgqF8-PDx8Q8jR9flMJmtk9emkO0BwCO3_3de2-3P7L-mANX5KZOWAtjeEGe-uaS3buk5Taajs48B9Zx49fGhWpUREbFZZ9nLZl1tg67tXQnwnpJTIaDlJpaGs3WDu7YfNGKqOXN_mfkwFr9AEvasc-7slulVHWJKbhHbsEbZWRGrXUOoqZXl2d_d4vsqJcCLq-fq9k-n7sSzBNwX0laJpQ53MYYyu9j9trpdKCVvSJena9VA2NjxQ67uNxNdzKQQc6nf4C-0LBhw?type=png)

## The Line

Every check on your list goes on one side of a single question:

> **Can a simple rule check it?**

- **Yes → the computer checks it.** You can count it or match it exactly. The computer gives the same answer every time, on every machine, forever. No opinion, no drift.
- **No → a person checks it.** It needs taste or judgement. The right answer was written down by a person *ahead of time* — that is what the golden set stores.

The two sides are not equal. **Let the computer do it wherever it can**, because a simple rule never quietly changes its mind. A check only moves to the person's side when no simple rule can capture it.

## Where Each Move 1 Failure Sits

This line is not made up — it comes straight from the real failures in [Move 1](./summary.md):

| Move 1 failure | Who checks it | Why |
| --- | --- | --- |
| Tennis bracelet showed **17 stones, not 20** | **The computer** | A count is exact. "Is it 20 stones?" is a simple rule. |
| X post **over 280 characters** | **The computer** | "Is it 280 characters or fewer?" — just counting, no opinion. |
| **Banned discount** word showed up when it was forbidden | **The computer** | Check the text against a banned-word list. Same answer every time. |
| Rose gold came out **yellow gold** | **The computer** | The colour was named in the brief, so the answer is exact. |
| Filigree **melted into blobs** | **A person** | "Melted" is a judgement about how it looks. No simple rule. |
| Tone not **premium** enough | **A person** | Taste. There is no rule for it. |

Most of the failures builders were about to ship were on the **computer's side** — exact, countable things a simple rule would have caught instantly. That is the cheap, reliable bulk of the value, and it is why we push as much as possible to that side.

## Where the AI Sits

The AI is **not the grader**. It sits off to the side with a dashed arrow into the grader and one rule attached:

> **It only gives an opinion. It never makes the final call.**

The AI can *suggest* an answer on a person's-side check ("this filigree looks melted"), or *draft* a golden answer for a person to confirm — but the call that decides pass or fail belongs to **the grader**, and the grader is tied to an answer a person wrote. The AI is a fast helper that points at things; by default it is never the judge of record.

> **Later extension — opt-in `judge` mode.** The shipped tool adds a per-rubric **grader mode**. In the default `suggest` mode the boundary above holds exactly: the AI only flags, a human decides (`llm_suggested`, verdict pending). A builder can instead opt a fuzzy rubric into `judge` mode, where the AI acts as a *first-pass* grader and records a pass/fail (`llm_judge`) — but this never removes the person from the loop: every AI verdict is overridable, and the human override (`decided_by: 'human'`) remains the final call. Machine rules still decide wherever they exist. So the principle is intact — a person owns the verdict of record — and `judge` mode is a speed-up the builder explicitly turns on, fenced by the same check-the-checker discipline below.

## The Failure Mode I Accepted

Drawing this line means choosing how I'm willing to be wrong. **The failure I accept is: the person's side can disagree with itself.**

- On the **computer's side** there is basically no risk — a simple rule is exact. If it isn't 20 stones, it fails, every time. The only thing that can go wrong is a *badly written* rule, and that is a bug to fix, not an opinion.
- On the **person's side**, two reasonable people (or two AI runs) can split on "does this feel premium?" or "does this look broken?" I accept that this side carries some unavoidable disagreement. I do **not** try to fake a hard rule for it — that would be a lie dressed up as a number.

What keeps this honest is the project's core rule — **check the checker**:

> Before a fuzzy check is trusted on a new case, it first has to fail the answers we **already know are bad** and pass the ones we **already know are fine**.

So the person's-side error is fenced in by a warm-up test, not left wide open. I would rather have a grader that is *exact where it can be and honest about being unsure where it can't*, than one that fakes certainty about taste and ships a wrong "pass" — the single most dangerous thing [Move 1](./summary.md) turned up.

## Deliverable Check

- ✅ The line is drawn — the single question "can a simple rule check it?"
- ✅ The grader is marked — **THE GRADER** is the circled node in the middle; the AI sits outside it and only suggests by default (and even in opt-in `judge` mode its verdict is a first pass a human can override).
- ✅ The accepted failure is named — unavoidable disagreement on the person's side, fenced in by the check-the-checker warm-up test.
