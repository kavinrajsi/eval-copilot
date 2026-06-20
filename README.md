# Eval Copilot

> **A tool that tells a builder whether the AI inside their own app is actually good, or just happens to run.**

A submission for the **Code Path Hackathon**, [Track B: The Eval Co-pilot](#the-track).

A builder describes their AI feature and hands over a few example inputs. Eval Copilot helps them turn those into a **golden set** (inputs paired with what a good output looks like) and a **rubric** (the rule for grading any output), runs the feature against both, and returns the exact cases where it fails — the failures they were about to ship and didn't know about.

Not a benchmark. Not a dashboard of green checkmarks. A list of the places your own AI is wrong.

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
| **4. Draw the domain model**                                       | Hand-draw the schema (feature → golden cases → rubric → run → grade), mark the run-to-run comparison keys, add row-level security + two-user test. | Hand-drawn schema + proof the two-user test passes.                                          |
| **5. Put it in front of two people, report what really happened**  | Two builders run their own feature through the tool (one cold); capture before-run → change → after-run.                                           | The before/after evidence + the surprise.                                                    |

> **Who verifies the verifier?** The builder does — against cases they already have a verdict on. Before the rubric is trusted on an unseen case, it must flag the outputs already known to be bad and pass the ones already known to be fine.

## The application

The app is the plumbing the five moves run on. It is a **Next.js 16** application with multi-user authentication already wired up — the foundation for **Move 4**, where every builder's golden sets, rubrics, and runs must be isolated per user (row-level security + a two-user test).

What's built today:

- **Multi-user auth** — email/password sign-up and sign-in backed by **Supabase Auth**, with cookie-based sessions that work across Server Components, Server Actions, and middleware.
- **Protected routes** — `/dashboard` is guarded in middleware (unauthenticated requests redirect to `/login`) and again in the page itself as defense in depth. Authenticated users hitting `/login` are bounced to `/dashboard`.
- **Session refresh** — middleware refreshes the auth token on every request via Supabase's verified `getClaims()`, keeping the browser and server in sync.
- **UI kit** — the full **shadcn/ui** component set (55 components, `base-nova` style, neutral base color, light/dark via CSS variables) ready to compose the golden-set / rubric / run surfaces.

### Routes

| Route        | Type    | Description                                                        |
| ------------ | ------- | ------------------------------------------------------------------ |
| `/`          | Static  | Starter home page                                                  |
| `/login`     | Static  | Email/password sign-in and sign-up card                            |
| `/dashboard` | Dynamic | Protected — shows the signed-in user's email and ID, plus sign-out |

### Auth flow

1. The `/login` form posts to the `authenticate` **Server Action** (`src/app/login/actions.js`), which calls `supabase.auth.signInWithPassword()` or `supabase.auth.signUp()` based on which button was pressed. Errors and "check your email" states render inline.
2. On success the session is written to secure cookies and the user is redirected to `/dashboard`.
3. `src/middleware.js` runs `updateSession()` on every matched request: it refreshes claims and enforces the redirect rules above.
4. `signout()` clears the session and returns to `/login`.

> **Security note:** authorization decisions read the verified JWT `claims` from `getClaims()` — never `user_metadata`, which is user-editable. The publishable key is browser-safe by design, which is why it carries the `NEXT_PUBLIC_` prefix.

## Tech stack

| Area        | Choice                                                       |
| ----------- | ------------------------------------------------------------ |
| Framework   | Next.js 16.2.9 (App Router, React Compiler enabled)          |
| Language    | JavaScript / JSX (no TypeScript)                             |
| UI          | React 19.2.4                                                 |
| Styling     | Tailwind CSS v4 (`@import "tailwindcss"`, PostCSS plugin)    |
| Components  | shadcn/ui (`base-nova` style) + lucide-react icons           |
| Auth & data | Supabase (`@supabase/supabase-js`, `@supabase/ssr`)          |
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
```

Both values come from your Supabase dashboard → **Project Settings → API**. Use the **publishable** key (not the secret/service-role key).

> If email confirmation is enabled in **Authentication → Providers → Email**, a new sign-up won't get a session until the user confirms via email — the login form will show "Check your email to confirm your account." Disable it for faster local testing.

### 3. Run

```bash
npm run dev      # start the dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

Visit `http://localhost:3000/dashboard` → you'll be redirected to `/login`. Create an account, sign in, and you'll land on the dashboard.

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
├── doc/                        Hackathon evidence (Moves 1–3)
│   ├── hypothesis.md             Move 2 — the timestamped bet
│   ├── who-checks-what.md        Move 3 — computer checks vs. human judgement
│   ├── summary.md                Executive summary across all evaluations
│   └── user-1.md … user-4.md     Move 1 — per-builder eval records
├── public/                     Static assets
└── src/
    ├── app/
    │   ├── layout.js             Root layout (Geist fonts, TooltipProvider)
    │   ├── page.js               Home page
    │   ├── globals.css           Tailwind v4 import + theme tokens (light/dark)
    │   ├── login/
    │   │   ├── page.js           Sign-in / sign-up form
    │   │   └── actions.js        authenticate() + signout() server actions
    │   └── dashboard/
    │       └── page.js           Protected route
    ├── middleware.js             Runs session refresh + route guards
    ├── components/ui/            55 shadcn/ui components
    ├── hooks/
    │   └── use-mobile.js         useIsMobile() viewport hook
    └── lib/
        ├── utils.js              cn() class-merge helper
        └── supabase/
            ├── client.js         Browser client (createBrowserClient)
            ├── server.js         Server client (cookie-based)
            └── middleware.js     updateSession() + redirect rules
```

## The track

This project targets **Track B: The Eval Co-pilot** of the Code Path Hackathon — a 24-hour sprint built on one principle:

> Build the service. Earn the software. Verify the verifier.

The app is plumbing — it must run and the walls must hold, but there are no points for polish. The grade is the evidence that the tool surfaced a real failure a human then acted on. An honest disproof beats a polished fake.
