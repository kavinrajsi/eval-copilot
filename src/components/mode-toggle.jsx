"use client";

import { ContrastIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

// Single-click light↔dark toggle, shadcn.com-style contrast-circle icon.
// The icon is theme-independent, so there's no hydration mismatch to guard.
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <ContrastIcon className="size-4" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
