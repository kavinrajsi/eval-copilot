"use server";

import { getSiteURL } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(prevState, formData) {
  const email = formData.get("email");
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const origin = await getSiteURL();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always respond neutrally — never reveal whether an account exists.
  return {
    message:
      "If an account exists for that email, a password reset link is on its way.",
  };
}
