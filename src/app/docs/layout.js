import Link from "next/link";
import { ArrowLeftIcon, MenuIcon } from "lucide-react";

import { DocsNav } from "@/components/docs-sidebar";
import { ModeToggle } from "@/components/mode-toggle";

export default function DocsLayout({ children }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/" className="font-mono text-sm font-medium tracking-tight">
          Eval&nbsp;Copilot
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            <span className="hidden sm:inline">Back to home</span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        {/* mobile: collapsible nav */}
        <details className="group rounded-lg border lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium select-none">
            <MenuIcon className="size-4" />
            Browse docs
          </summary>
          <div className="border-t px-3 py-3">
            <DocsNav />
          </div>
        </details>

        {/* desktop: sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <DocsNav />
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
