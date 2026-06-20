"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function authenticate(prevState, formData) {
  const supabase = await createClient();

  const credentials = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const intent = formData.get("intent");

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) return { error: error.message };

    // When email confirmation is enabled, no session is returned yet.
    if (!data.session) {
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
