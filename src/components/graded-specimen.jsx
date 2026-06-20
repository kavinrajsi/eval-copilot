"use client";

import { useEffect, useRef, useState } from "react";

// A plausible, shippable-looking model output — drawn from a real graded case
// (Multi-Channel Social Generation): the rubric banned discount language and
// capped the X post at 280 characters. The output breaks both, and looks fine.
const PRE =
  "Introducing the Aurelia collection — hand-set lab-grown diamonds in recycled 18k gold, designed to be worn every day and kept for a lifetime. The full launch drops this Friday at midnight. ";
const VIOLATION =
  "Enjoy 15% off your very first order this week only with code AURELIA15 at checkout.";
const POST = " ✨ #fineJewellery #labGrownDiamonds #newDrop";

const FULL = PRE + VIOLATION + POST;
const LIMIT = 280;

export function GradedSpecimen() {
  // graded === false → looks fine. graded === true → marked wrong.
  const [graded, setGraded] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setGraded(true);
      return;
    }
    const t = setTimeout(() => setGraded(true), 900);
    return () => clearTimeout(t);
  }, []);

  const over = FULL.length - LIMIT;

  return (
    <figure className="relative isolate overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* sweep line */}
      <span
        aria-hidden
        className="grading-scan pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-redpen/15 to-transparent"
        style={{ "--scan-travel": "16rem" }}
      />

      {/* submission header */}
      <figcaption className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-[0.7rem] tracking-wide">
        <span className="flex items-center gap-2 text-muted-foreground uppercase">
          <span className="inline-block size-1.5 rounded-full bg-muted-foreground/50" />
          Submitted output · X post
        </span>
        <span
          data-graded={graded}
          className={
            graded
              ? "font-medium text-redpen tabular-nums transition-colors"
              : "text-muted-foreground tabular-nums transition-colors"
          }
        >
          {FULL.length} / {LIMIT}
        </span>
      </figcaption>

      {/* the output being graded */}
      <div className="px-4 py-4 font-mono text-[0.82rem] leading-relaxed text-foreground">
        {PRE}
        <span data-graded={graded} className="mark-underline">
          {VIOLATION}
        </span>
        {POST}
      </div>

      {/* margin marks — only appear once graded */}
      <div className="space-y-1.5 border-t px-4 py-3">
        <p
          data-graded={graded}
          style={{ transitionDelay: "120ms" }}
          className="grade-rise flex items-start gap-2 text-xs text-muted-foreground"
        >
          <span className="mt-px font-mono font-semibold text-redpen">✗</span>
          <span>
            <span className="text-foreground">Over the {LIMIT}-character limit</span>{" "}
            by {over} — would be truncated mid-sentence.
          </span>
        </p>
        <p
          data-graded={graded}
          style={{ transitionDelay: "320ms" }}
          className="grade-rise flex items-start gap-2 text-xs text-muted-foreground"
        >
          <span className="mt-px font-mono font-semibold text-redpen">✗</span>
          <span>
            <span className="text-foreground">Discount language</span> — banned by
            your rubric, every channel.
          </span>
        </p>
      </div>

      {/* verdict */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-3">
        <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          Graded against your golden answer
        </span>
        <span
          data-graded={graded}
          className="grade-rise inline-flex items-center gap-2 rounded-md border border-redpen/30 bg-redpen/10 px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-redpen"
          style={{ transitionDelay: "520ms" }}
        >
          {graded ? "FAIL · 0 of 2 rules met" : "Grading…"}
        </span>
      </div>
    </figure>
  );
}
