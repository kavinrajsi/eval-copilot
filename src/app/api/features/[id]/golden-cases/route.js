import { badRequest, ok, requireUser } from "@/lib/api";

// GET /api/features/:id/golden-cases — list this feature's golden set
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("golden_case")
    .select("id, input, known_good, created_at")
    .eq("feature_id", id)
    .order("created_at", { ascending: true });

  if (error) return badRequest(error.message);
  return ok({ golden_cases: data });
}

// POST /api/features/:id/golden-cases — add one case, or a batch
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

  const { data, error } = await auth.supabase
    .from("golden_case")
    .insert(rows)
    .select("id, input, known_good, created_at");

  if (error) return badRequest(error.message);
  return ok({ golden_cases: data }, 201);
}
