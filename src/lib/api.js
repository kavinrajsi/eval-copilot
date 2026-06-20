import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the authenticated user for an API route. The Supabase client is
 * cookie-backed, so every query runs as this user and RLS is enforced by the
 * database — these checks are belt-and-suspenders, not the security boundary.
 *
 * @returns {Promise<{supabase, user} | {error: NextResponse}>}
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}

export function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
