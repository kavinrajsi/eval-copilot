import Link from "next/link";
import { GalleryVerticalEndIcon } from "lucide-react";

// Shared layout for the auth pages (login / signup / forgot / reset): a brand
// mark above a centered card on a muted background — the login-03 block shell.
export function AuthShell({ children }) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEndIcon className="size-4" />
          </div>
          Eval Copilot
        </Link>
        {children}
      </div>
    </div>
  );
}
