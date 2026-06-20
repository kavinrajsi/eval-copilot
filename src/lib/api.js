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

// Row/payload batch size for inserts and paginated reads.
export const CHUNK_SIZE = 500;

/**
 * Insert rows in CHUNK_SIZE batches so large imports stay under payload limits.
 * Returns { data } (selected rows, when `select` is given) or { error }.
 */
export async function insertChunked(supabase, table, rows, select, size = CHUNK_SIZE) {
  let out = [];
  for (let k = 0; k < rows.length; k += size) {
    let query = supabase.from(table).insert(rows.slice(k, k + size));
    if (select) query = query.select(select);
    const { data, error } = await query;
    if (error) return { error };
    if (select && data) out = out.concat(data);
  }
  return { data: out };
}

/**
 * Parse ?limit/&offset from a request URL. When `limit` is absent, paginated is
 * false (caller returns everything). Used by the paginated GET routes.
 */
export function paginationParams(url, { max = CHUNK_SIZE, defaultLimit = 50 } = {}) {
  const limitParam = url.searchParams.get("limit");
  if (limitParam == null) return { paginated: false, limit: 0, offset: 0 };
  const limit = Math.min(max, Math.max(1, Number(limitParam) || defaultLimit));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  return { paginated: true, limit, offset };
}
