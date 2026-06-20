import { badRequest, ok, requireUser } from "@/lib/api";

// GET /api/features/:id/rubric — the latest rubric for this feature
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("rubric")
    .select("id, rule_text, rules, created_at")
    .eq("feature_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return badRequest(error.message);
  return ok({ rubric: data });
}

// POST /api/features/:id/rubric — save a rubric (text + machine rules)
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const rule_text = body.rule_text?.trim();
  if (!rule_text) return badRequest("rule_text is required");

  const rules = Array.isArray(body.rules) ? body.rules : [];

  const { data, error } = await auth.supabase
    .from("rubric")
    .insert({ feature_id: id, rule_text, rules })
    .select("id, rule_text, rules, created_at")
    .single();

  if (error) return badRequest(error.message);
  return ok({ rubric: data }, 201);
}
