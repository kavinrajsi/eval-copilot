import { redirect } from "next/navigation";

import { ProfileForm, PasswordForm } from "./account-forms";
import { SiteHeader } from "@/components/site-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account settings · Eval Copilot" };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = user.user_metadata?.full_name ?? "";
  const email = user.email ?? "";
  const displayName = fullName || (email ? email.split("@")[0] : "Account");
  const initial = (fullName || email || "?")[0].toUpperCase();

  return (
    <>
      <SiteHeader title="Account settings" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 rounded-lg">
            <AvatarFallback className="rounded-lg text-base">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0">
            <span className="truncate text-lg font-semibold">{displayName}</span>
            <span className="text-muted-foreground truncate text-sm">
              {email}
            </span>
          </div>
        </div>
        <ProfileForm fullName={fullName} email={email} />
        <PasswordForm />
      </div>
    </>
  );
}
