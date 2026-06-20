import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { groupedDocs } from "@/lib/docs-nav";

export const metadata = { title: "Docs · Eval Copilot" };

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Documentation
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          How Eval Copilot was built, and what it found.
        </h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          The evidence from grading real shipping features by hand, the bet made
          before building, and the design of the tool itself — the full record
          behind turning “it works on what I tried” into something you can see.
        </p>
      </header>

      {groupedDocs().map(({ group, docs }) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {group}
          </h2>
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {docs.map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className="group flex items-center justify-between gap-3 bg-card p-4 transition-colors hover:bg-accent"
              >
                <span className="text-sm font-medium">{doc.title}</span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
