"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { groupedDocs } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

function NavLink({ href, children }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function DocsNav() {
  return (
    <nav className="flex flex-col gap-5">
      <NavLink href="/docs">Overview</NavLink>
      {groupedDocs().map(({ group, docs }) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="px-2 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {group}
          </span>
          {docs.map((doc) => (
            <NavLink key={doc.slug} href={`/docs/${doc.slug}`}>
              {doc.title}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
