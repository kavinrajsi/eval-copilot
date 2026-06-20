"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSiteURL } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function authenticate(prevState, formData) {
  const supabase = await createClient();

  const credentials = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const intent = formData.get("intent");

  if (intent === "signup") {
    const confirm = formData.get("confirm");
    if (confirm != null && credentials.password !== confirm) {
      return { error: "Passwords do not match." };
    }

    const fullName = formData.get("name");
    const origin = await getSiteURL();
    const { data, error } = await supabase.auth.signUp({
      ...credentials,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
        ...(fullName ? { data: { full_name: fullName } } : {}),
      },
    });
    if (error) return { error: error.message };

    // When email confirmation is enabled, no session is returned yet.
    if (!data?.session) {
      return { message: "Check your email to confirm your account." };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
