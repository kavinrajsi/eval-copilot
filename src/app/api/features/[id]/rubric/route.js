import { badRequest, ok, requireUser } from "@/lib/api";
import { validateRules } from "@/lib/grading";

// GET /api/features/:id/rubric — the latest rubric for this feature
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("rubric")
    .select("id, rule_text, rules, grader_mode, criteria, pass_threshold, created_at")
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
  const check = validateRules(rules);
  if (!check.ok) return badRequest(check.error);

  const grader_mode = body.grader_mode === "judge" ? "judge" : "suggest";

  // Multi-criteria scoring (judge mode): a list of { name, description? } and a
  // pass threshold. Keep only well-formed, named criteria.
  const criteria = Array.isArray(body.criteria)
    ? body.criteria
        .filter((c) => c && typeof c.name === "string" && c.name.trim())
        .map((c) => ({ name: c.name.trim(), description: String(c.description ?? "").trim() }))
    : [];
  let pass_threshold = Number(body.pass_threshold);
  if (!Number.isFinite(pass_threshold)) pass_threshold = 70;
  pass_threshold = Math.min(100, Math.max(0, Math.round(pass_threshold)));

  const { data, error } = await auth.supabase
    .from("rubric")
    .insert({ feature_id: id, rule_text, rules, grader_mode, criteria, pass_threshold })
    .select("id, rule_text, rules, grader_mode, criteria, pass_threshold, created_at")
    .single();

  if (error) return badRequest(error.message);
  return ok({ rubric: data }, 201);
}
