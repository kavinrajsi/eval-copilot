import Link from "next/link";

import { GradedSpecimen } from "@/components/graded-specimen";
import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";

// The two ideas the tool is built around — a pair, not a sequence.
const ideas = [
  {
    term: "Golden set",
    def: "Inputs where a human decided what a good output looks like — written down before the model runs. The answer key almost nobody has.",
  },
  {
    term: "Rubric",
    def: "The rule that turns “is this good?” into something you apply the same way twice: the dimensions you grade on, and what passing means on each.",
  },
];

// Real evidence — four shipping AI features graded by hand. See doc/.
const graded = [
  {
    rate: 20,
    feature: "Jewellery image generator",
    silent: "Stone count dropped 20 → 17; rose gold rendered as yellow",
  },
  {
    rate: 20,
    feature: "Multi-channel social posts",
    silent: "Banned discount language shipped; X post over 280 chars",
  },
  {
    rate: 60,
    feature: "Brand rulebook classifier",
    silent: "Passed colour and logo-size violations as compliant",
  },
  {
    rate: 40,
    feature: "SEO content generator",
    silent: "Invented an “IGI-Graded” certification that doesn’t exist",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* product bar */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-mono text-sm font-medium tracking-tight">
          Eval&nbsp;Copilot
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* hero — the headline narrates the specimen beside it */}
        <section className="grid gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              The eval co-pilot
            </span>
            <h1 className="font-mono text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
              This output looks fine.
              <br />
              <span className="relative inline-block text-redpen">
                It&apos;s wrong.
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1 h-[3px] bg-redpen"
                />
              </span>
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              An LLM produces plausible output on anything, forever — so “it ran”
              stopped meaning “it’s good.” Eval Copilot grades your feature on
              inputs you didn’t cherry-pick, against an answer you committed to in
              advance, and hands back the exact cases where it fails.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
                Grade my feature
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* signature */}
          <GradedSpecimen />
        </section>

        {/* the two ideas — a pair */}
        <section className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
          {ideas.map((idea) => (
            <div key={idea.term} className="bg-card p-6 sm:p-8">
              <h2 className="font-mono text-sm font-semibold tracking-tight">
                {idea.term}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {idea.def}
              </p>
            </div>
          ))}
        </section>

        {/* real evidence */}
        <section className="py-16 lg:py-24">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance">
              We graded four shipping features by hand. Every failure below would
              have shipped.
            </h2>
            <span className="font-mono text-xs tracking-wide text-muted-foreground whitespace-nowrap">
              % = cases that passed
            </span>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {graded.map((g) => (
              <div key={g.feature} className="flex flex-col gap-3 bg-card p-5">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-mono text-3xl font-semibold tracking-tight tabular-nums ${
                      g.rate <= 40 ? "text-redpen" : "text-foreground"
                    }`}
                  >
                    {g.rate}
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-sm font-medium">{g.feature}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {g.silent}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
            Not a benchmark. Not a wall of green checkmarks. A list of the places
            your own AI is wrong — graded against an answer you committed to in
            advance.
          </p>
        </section>
      </main>

      <footer className="border-t px-6 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            Eval Copilot
          </span>
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Start with your own feature →
          </Link>
        </div>
      </footer>
    </div>
  );
}
