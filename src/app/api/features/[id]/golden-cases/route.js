import { badRequest, insertChunked, ok, paginationParams, requireUser } from "@/lib/api";

const COLS = "id, input, known_good, created_at";

// GET /api/features/:id/golden-cases — list this feature's golden set.
// Pass ?limit= (and ?offset=) for a paginated page + exact total; with no
// limit it returns every case (the workspace loads the full set for runs).
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { paginated, limit, offset } = paginationParams(new URL(request.url));
  let query = auth.supabase
    .from("golden_case")
    .select(COLS, paginated ? { count: "exact" } : {})
    .eq("feature_id", id)
    .order("created_at", { ascending: true });
  if (paginated) query = query.range(offset, offset + limit - 1);

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
    .map((c) => ({ feature_id: id, input: c.input?.trim(), known_good: c.known_good?.trim() }))
    .filter((r) => r.input && r.known_good);

  if (!rows.length) return badRequest("each case needs input and known_good");

  const { data, error } = await insertChunked(auth.supabase, "golden_case", rows, COLS);
  if (error) return badRequest(error.message);
  return ok({ golden_cases: data, inserted: data.length }, 201);
}
