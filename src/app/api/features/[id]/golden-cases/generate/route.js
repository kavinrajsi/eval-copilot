import { badRequest, ok, requireUser } from "@/lib/api";
import { generateCases } from "@/lib/grading";

// POST /api/features/:id/golden-cases/generate — AI drafts candidate golden
// cases from the feature's knowledge + latest rubric. Returns candidates only;
// NOTHING is saved (a human reviews/edits/approves, then POSTs the kept ones).
// Body: { count, seeds? }
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const count = Math.min(200, Math.max(1, Math.round(Number(body.count) || 10)));
  const seeds = typeof body.seeds === "string" ? body.seeds : "";

  const [{ data: feature }, { data: rubric }] = await Promise.all([
    supabase.from("feature").select("knowledge").eq("id", id).maybeSingle(),
    supabase
      .from("rubric")
      .select("rule_text, rules")
      .eq("feature_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const result = await generateCases(
    count,
    feature?.knowledge ?? "",
    rubric?.rule_text ?? "",
    rubric?.rules ?? [],
    seeds,
  );
  if (result.error) return badRequest(result.error);
  return ok({ candidates: result.candidates });
}
