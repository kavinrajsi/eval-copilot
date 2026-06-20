import { badRequest, ok, requireUser } from "@/lib/api";

const CHUNK = 500; // insert/select batch size — keeps payloads sane at scale

// GET /api/features/:id/golden-cases — list this feature's golden set.
// Pass ?limit= (and ?offset=) for a paginated page + exact total; with no
// limit it returns every case (the workspace loads the full set for runs).
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const paginated = limitParam != null;

  let query = auth.supabase
    .from("golden_case")
    .select("id, input, known_good, created_at", paginated ? { count: "exact" } : {})
    .eq("feature_id", id)
    .order("created_at", { ascending: true });

  if (paginated) {
    const limit = Math.min(CHUNK, Math.max(1, Number(limitParam) || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) return badRequest(error.message);
  return ok({ golden_cases: data, total: count ?? data.length });
}

// POST /api/features/:id/golden-cases — add one case, or a batch (chunked).
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body.cases) ? body.cases : [body];

  const rows = incoming
    .map((c) => ({
      feature_id: id,
      input: c.input?.trim(),
      known_good: c.known_good?.trim(),
    }))
    .filter((r) => r.input && r.known_good);

  if (!rows.length) return badRequest("each case needs input and known_good");

  // Insert in chunks so a large import doesn't blow the request/row limits.
  let inserted = [];
  for (let k = 0; k < rows.length; k += CHUNK) {
    const { data, error } = await auth.supabase
      .from("golden_case")
      .insert(rows.slice(k, k + CHUNK))
      .select("id, input, known_good, created_at");
    if (error) return badRequest(error.message);
    inserted = inserted.concat(data);
  }

  return ok({ golden_cases: inserted, inserted: inserted.length }, 201);
}
