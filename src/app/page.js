import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ideas = [
  {
    title: "Golden set",
    description:
      "Inputs where a human decided what a good output looks like — written down before the model runs. The answer key almost nobody has.",
  },
  {
    title: "Rubric",
    description:
      "The rule that turns “is this output good?” into something you can apply the same way twice: the dimensions you grade on, and what passing means on each.",
  },
  {
    title: "The failures",
    description:
      "Run your feature against both and get back the exact cases where it fails — the ones you were about to ship and didn’t know about.",
  },
];

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <main className="w-full max-w-3xl">
        <section className="flex flex-col items-start gap-6">
          <span className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Eval Copilot
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Find out whether the AI inside your app is actually good — or just
            happens to run.
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            “It works on the things I tried” is worthless as a signal. Describe
            your AI feature, hand over a few example inputs, and Eval Copilot
            turns them into a golden set and a rubric, runs your feature against
            both, and returns the exact cases where it&apos;s wrong.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Get started
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.title}>
              <CardHeader>
                <CardTitle>{idea.title}</CardTitle>
                <CardDescription>{idea.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="mt-10">
          <Card>
            <CardContent className="text-muted-foreground text-sm">
              Not a benchmark. Not a dashboard of green checkmarks. A list of the
              places your own AI is wrong — graded against an answer you
              committed to in advance.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
