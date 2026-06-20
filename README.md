# Eval Copilot

> **A tool that tells a builder whether the AI inside their own app is actually good, or just happens to run.**

A submission for the **Code Path Hackathon**, [Track B: The Eval Co-pilot](#the-track).

A builder describes their AI feature and hands over a few example inputs. Eval Copilot helps them turn those into a **golden set** (inputs paired with what a good output looks like) and a **rubric** (the rule for grading any output), runs the feature against both, and returns the exact cases where it fails — the failures they were about to ship and didn't know about.

Not a benchmark. Not a dashboard of green checkmarks. A list of the places your own AI is wrong.

> **New here?** See the [step-by-step guide](./doc/getting-started.md), or just sign in — a spotlight walkthrough runs automatically on your first visit (replay it anytime from the **Walkthrough** button).

## Why this exists

"It works on the things I tried" is worthless as a signal. You chose those inputs because you already knew they'd pass — a signal you hand-selected to be positive is a mirror, not an instrument. An LLM will produce plausible output on anything, forever, so "it ran" stopped meaning "it is good" the moment a model went into the middle of the app.

The only thing that separates a good AI feature from a lucky one is its behavior on inputs you **did not** cherry-pick, graded against an answer you committed to **in advance**. That is what a golden set is. This tool makes "good" something you can see instead of something you hope for.

## The two ideas it's built around

- **Golden set** — a list of inputs where a human decided what a good output looks like, written down _before_ the model runs. The answer key almost nobody has.
- **Rubric** — the rule that turns "is this output good?" into something you can apply the same way twice: the dimensions you grade on, and what passing means on each.

## Evaluation evidence

The [doc/](doc/) folder holds the **Move 1** evidence — being the eval by hand against real AI features that builders were shipping. Each report defines a pass condition, runs five known-good cases, grades actual vs. expected, and records whether the failure was one the builder _would have shipped_.

| Evaluator                    | Feature graded                  | Pass rate | Score     | Most critical silent failure                                   |
| ---------------------------- | ------------------------------- | --------- | --------- | -------------------------------------------------------------- |
| [Maha](./doc/user-1.md)      | AI Jewellery Image Generator    | 20%       | **1 / 5** | Wrong stone count (20→17), melted filigree, rose→yellow gold   |
| [Ananth](./doc/user-2.md)    | Multi-Channel Social Generation | 20%       | **1 / 5** | Discount mention when explicitly banned; X post over 280 chars |
| [Siddharth](./doc/user-3.md) | Brand Rulebook Classifier       | 60%       | **3 / 5** | False passes on colour and logo-size violations                |
| [Manoj](./doc/user-4.md)     | SEO Content Generator           | 40%       | **2 / 5** | Invented "IGI-Graded" certification claim                      |

See [doc/summary.md](./doc/summary.md) for the executive summary.

**What the evidence shows:**

- **Silent failures dominate.** Across all four evaluations, the failing cases would have shipped — every output looked production-ready at a glance.
- **False passes are the highest risk.** The rulebook classifier approved non-compliant assets as compliant — far more dangerous than a false fail, because nothing flags them downstream.
- **Invented claims create real exposure.** Fabricated certifications and prohibited messaging carry legal and brand risk beyond quality.
- **Constraint violations go undetected.** Character limits, length caps, and exact counts are breached with no warning to the user.

## The five moves

Track B walks the shared five-move spine. Each move ends in a deliverable.

| Move                                                               | What you do                                                                                                                                        | Submit                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **1. Be the eval yourself, on two real apps**                      | Sit with 2 builders, force 5 known-good cases into existence, run their feature, grade by hand.                                                    | The raw record + whether they had any answer key before you sat down. → [doc/](doc/)         |
| **2. Write down your bet, before you build**                       | Claim + 3 numbers + kill-number, as your first timestamped commit.                                                                                 | The timestamped hypothesis. → [doc/hypothesis.md](./doc/hypothesis.md)                       |
| **3. Decide what the computer checks, and what only a person can** | Draw the line between what a simple rule can check and what needs judgement; mark who makes the final call.                                        | The diagram + the failure you accepted. → [doc/who-checks-what.md](./doc/who-checks-what.md) |
| **4. Draw the domain model**                                       | Hand-draw the schema (feature → golden cases → rubric → run → grade), mark the run-to-run comparison keys, add row-level security. | Schema + ownership walls. → [doc/domain-model.md](./doc/domain-model.md)                 |
| **5. Put it in front of two people, report what really happened**  | Two builders run their own feature through the tool (one cold); capture before-run → change → after-run.                                           | Before/after evidence + the surprise. → [doc/testing.md](./doc/testing.md)     |

> **Who verifies the verifier?** The builder does — against cases they already have a verdict on. Before the rubric is trusted on an unseen case, it must flag the outputs already known to be bad and pass the ones already known to be fine.

## The application

The app is the plumbing the five moves run on — a full **Next.js 16** application where a builder can evaluate their AI feature end to end, with every builder's data isolated per user (row-level security).

What's built today:

- **Multi-user auth** — separate email/password **sign-in** (`/login`) and **sign-up** (`/signup`) pages plus **password recovery** (`/forgot-password` → emailed link → `/reset-password`), backed by **Supabase Auth** with cookie sessions that work across Server Components, Server Actions, and the routing proxy.
- **Protected routes** — `/dashboard` and its sub-routes are guarded in `src/proxy.js` (unauthenticated requests redirect to `/login`) and again in the layout as defense in depth; authenticated users hitting `/login` are bounced to `/dashboard`.
- **Dashboard** — a sidebar + sticky-header shell (the shadcn `dashboard-01` layout, rebuilt natively on `base-nova`) with KPI cards, a pass-rate-by-run chart (recharts), and a features table.
- **Feature workspace** — per feature, the seven-tab flow **Knowledge → Golden Set → Rubric → Run → Results → Compare → Quick test** (`src/app/dashboard/[featureId]/feature-workspace.jsx`).
- **Knowledge** — a per-feature reference doc (e.g. brand guidelines) edited before the golden set and injected into every AI grading prompt as `SOURCE / REFERENCE`; machine rules ignore it.
- **Grading engine** — deterministic machine rules decide where they can (`decided_by: rule`), including text-similarity rules (`rouge_l`, `jaccard`) measured against the known-good. For fuzzy cases the rubric's grader mode either has the AI **suggest** a possible failure for a human to confirm (`llm_suggested`, verdict pending) or **judge** pass/fail (`llm_judge`, human-overridable) — and in judge mode with **criteria**, scores each dimension 0–100 plus an overall vs a pass threshold. Uses the Anthropic SDK when `ANTHROPIC_API_KEY` is set, with a key-free heuristic fallback.
- **Quick test** — grade any ad-hoc **text or image** against the rubric + knowledge (no run / golden case needed), saved to a per-feature history. A **Stability** check grades the same input N times to measure the AI's consistency (verdict agreement + score variance). Images go through a vision judge.
- **Confusion matrix & metrics** — Results draws a machine-vs-human matrix (false-pass / false-fail) with Accuracy / Precision / Recall / F1, using the preserved machine verdict (`grade.auto_verdict`) as the prediction and the human override as ground truth.
- **Onboarding walkthrough** — a driver.js spotlight tour that runs on first login and is replayable.
- **Theming** — light / dark / system via `next-themes`, toggled from a header button.
- **Starter features** — every new account is auto-provisioned a **Brand Rulebook Checker** and a **Madarth Brand Compliance** example (golden set + rubric, the latter with a Knowledge doc) via a Supabase signup trigger, so the dashboard isn't empty.
- **UI kit** — the full **shadcn/ui** component set (55 components, `base-nova` style, neutral base color).

### Routes

| Route                  | Type    | Description                                                           |
| ---------------------- | ------- | --------------------------------------------------------------------- |
| `/`                    | Static  | Landing page (pitch + Move 1 evidence)                                |
| `/login`               | Static  | Email/password sign-in                                                |
| `/signup`              | Static  | Create an account                                                     |
| `/forgot-password`     | Static  | Request a password reset link by email                                |
| `/reset-password`      | Static  | Set a new password (reached via the emailed reset link)               |
| `/auth/callback`       | Dynamic | Exchanges the email link's code for a session, then redirects         |
| `/dashboard`           | Dynamic | Protected — KPI cards, pass-rate chart, and the features table        |
| `/dashboard/new`       | Dynamic | Create a feature                                                      |
| `/dashboard/[id]`      | Dynamic | A feature's workspace (Knowledge / Golden Set / Rubric / Run / Results / Compare / Quick test) |

### Auth flow

1. `/login` and `/signup` post to Server Actions in `src/app/login/actions.js`, calling `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()`. Errors and "check your email" states render inline.
2. On success the session is written to secure cookies and the user is redirected to `/dashboard`. A Supabase trigger provisions the new account's starter feature on sign-up.
3. `src/proxy.js` runs `updateSession()` on every matched request: it refreshes claims (verified `getClaims()`) and enforces the redirect rules above.
4. `signout()` clears the session and returns to `/login` (invoked from the sidebar avatar menu).

**Password recovery:** `/forgot-password` posts to `requestPasswordReset` (`src/app/forgot-password/actions.js`), which calls `supabase.auth.resetPasswordForEmail()` with a `redirectTo` of `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`. The emailed link lands on `/auth/callback`, which calls `exchangeCodeForSession()` to establish a recovery session, then forwards to `/reset-password`. There the `updatePassword` action calls `supabase.auth.updateUser({ password })` and redirects to `/dashboard`. The reset link's redirect URL must be added to **Supabase → Authentication → URL Configuration → Redirect URLs**.

> **Security note:** authorization decisions read the verified JWT `claims` from `getClaims()` — never `user_metadata`, which is user-editable. The publishable key is browser-safe by design, which is why it carries the `NEXT_PUBLIC_` prefix.

## Tech stack

| Area        | Choice                                                       |
| ----------- | ------------------------------------------------------------ |
| Framework   | Next.js 16.2.9 (App Router, React Compiler enabled)          |
| Language    | JavaScript / JSX (no TypeScript)                             |
| UI          | React 19.2.4                                                 |
| Styling     | Tailwind CSS v4 (`@import "tailwindcss"`, PostCSS plugin)    |
| Components  | shadcn/ui (`base-nova` style, base-ui under the hood) + lucide-react icons |
| Auth & data | Supabase (`@supabase/supabase-js`, `@supabase/ssr`)          |
| AI grading  | `@anthropic-ai/sdk` (LLM suggest / judge), optional — heuristic fallback without a key |
| Charts      | recharts (pass-rate chart)                                   |
| Onboarding  | driver.js (spotlight walkthrough)                            |
| Theming     | next-themes (light / dark / system)                          |
| Linting     | ESLint 9 (`eslint-config-next/core-web-vitals`, flat config) |
| Path alias  | `@/*` → `src/*`                                              |

## Getting started

### Prerequisites

- Node.js (the project is developed on Node 26)
- A [Supabase](https://supabase.com) project (free tier is fine)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env.local` in the repo root (it is gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ANTHROPIC_API_KEY=<optional — enables the LLM suggest/judge graders>
ANTHROPIC_SUGGEST_MODEL=<optional — grader model; default claude-haiku-4-5, e.g. claude-sonnet-4-5>
```

The two Supabase values come from your dashboard → **Project Settings → API**. Use the **publishable** key (not the secret/service-role key). `NEXT_PUBLIC_SITE_URL` is the app's public origin — it builds the password-reset link's redirect target (set it to your deployed URL in production). Add `<NEXT_PUBLIC_SITE_URL>/auth/callback` to **Authentication → URL Configuration → Redirect URLs** so the reset link is accepted. `ANTHROPIC_API_KEY` is **optional** — set it to use Claude for the fuzzy-case graders; without it they fall back to a deterministic heuristic. `ANTHROPIC_SUGGEST_MODEL` is also optional — it picks the grader model (defaults to `claude-haiku-4-5`; set `claude-sonnet-4-5` for sharper judgement).

> If email confirmation is enabled in **Authentication → Providers → Email**, a new sign-up won't get a session until the user confirms via email — the login form will show "Check your email to confirm your account." Disable it for faster local testing.

### 3. Run

```bash
npm run dev            # start the dev server at http://localhost:3000
npm run build          # production build
npm run start          # serve the production build
npm run lint           # eslint
npm run verify         # verify-the-verifier: grader reproduces known Move 1 verdicts
npm run brand:madarth  # run the Madarth brand rules over sample copy
npm run uat            # simulated before→fix→after through the real engine
```

Visit `http://localhost:3000/dashboard` → you'll be redirected to `/login`. Create an account, sign in, then: **(optionally add Knowledge) → add golden cases → write a rubric → run → see results → compare two runs**, or use **Quick test** for an ad-hoc check.

> **Database schema** lives in `supabase/migrations/` (vendored from the project's Supabase migration history). On a fresh Supabase project, apply it with the Supabase CLI (`supabase db push`) or by running the SQL files in order.

## Repository structure

```text
.
├── README.md                  This file
├── AGENTS.md                  Notes for AI agents working in this repo
├── components.json             shadcn/ui config (base-nova, neutral, @/ aliases)
├── next.config.mjs             Next.js config (React Compiler on)
├── jsconfig.json               Path alias: @/* → src/*
├── eslint.config.mjs           ESLint 9 flat config
├── postcss.config.mjs          Tailwind v4 PostCSS plugin
├── package.json
├── doc/                        Hackathon evidence (Moves 1–5) + guide
│   ├── getting-started.md        New-user step-by-step guide
│   ├── hypothesis.md             Move 2 — the timestamped bet
│   ├── who-checks-what.md        Move 3 — computer checks vs. human judgement
│   ├── domain-model.md           Move 4 — schema, comparison keys, ownership walls
│   ├── testing.md                Move 5 — build, test matrices, dummy example
│   ├── summary.md                Executive summary across all evaluations
│   └── user-1.md … user-4.md     Move 1 — per-builder eval records
├── scripts/
│   ├── verify-grading.mjs       Verify-the-verifier (npm run verify)
│   ├── madarth-brand-check.mjs  Madarth brand rules over sample copy (npm run brand:madarth)
│   └── uat-simulation.mjs       Simulated before→fix→after (npm run uat)
├── supabase/
│   └── migrations/             Vendored DB schema (init → multi-criteria scores)
├── public/                     Static assets
└── src/
    ├── app/
    │   ├── layout.js             Root layout (fonts, ThemeProvider, Toaster)
    │   ├── page.js               Landing page
    │   ├── globals.css           Tailwind v4 import + theme tokens (light/dark)
    │   ├── login/, signup/       Sign-in / sign-up pages + server actions
    │   ├── forgot-password/      Request a reset link + server action
    │   ├── reset-password/       Set a new password + server action
    │   ├── auth/callback/        Code-for-session exchange (route handler)
    │   ├── dashboard/
    │   │   ├── layout.js         Sidebar + header shell (auth-guarded)
    │   │   ├── page.js           Overview: KPI cards, chart, features table
    │   │   ├── new/              Create-feature page + form
    │   │   └── [featureId]/      feature-workspace.jsx (the 5 tabs)
    │   └── api/                  Route handlers: features (+[id] GET/PATCH knowledge),
    │                               golden-cases (+delete), rubric, runs (+delete),
    │                               grades, compare, quick-test (+GET/DELETE), stability
    ├── proxy.js                  Session refresh + route guards
    ├── components/
    │   ├── app-sidebar / nav-user / site-header   Dashboard shell
    │   ├── section-cards / eval-chart / features-table   Dashboard content
    │   ├── login-form / signup-form / auth-shell   Auth UI
    │   ├── mode-toggle / theme-provider            Theming
    │   ├── walkthrough / graded-specimen           Tour + landing visual
    │   └── ui/                   55 shadcn/ui components
    ├── hooks/use-mobile.js
    └── lib/
        ├── grading.js            Grading engine (rules + similarity + AI suggest/judge/multi-criteria)
        ├── grading-claude.js     Anthropic calls: suggest / judge / multi-criteria / vision (server-only)
        ├── api.js                requireUser() + JSON helpers for routes
        ├── site-url.js           Public origin for auth redirect links
        ├── tours.js              Walkthrough step definitions
        ├── utils.js              cn() class-merge helper
        └── supabase/             Browser / server / proxy clients
```

## The track

This project targets **Track B: The Eval Co-pilot** of the Code Path Hackathon — a 24-hour sprint built on one principle:

> Build the service. Earn the software. Verify the verifier.

The app is plumbing — it must run and the walls must hold, but there are no points for polish. The grade is the evidence that the tool surfaced a real failure a human then acted on. An honest disproof beats a polished fake.
