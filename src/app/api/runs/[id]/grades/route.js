import { badRequest, ok, paginationParams, requireUser } from "@/lib/api";

// GET /api/runs/:id/grades — grades for a run, with each case's input.
// Pass ?limit (and ?offset) for a paginated page + exact total.
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const url = new URL(request.url);

  // reviewed=1 → just the human-decided rows that carry a machine verdict, for
  // the confusion matrix. Small subset, so it's returned whole (no pagination)
  // and the matrix stays correct even when the grade table is paged.
  if (url.searchParams.get("reviewed")) {
    const { data, error } = await auth.supabase
      .from("grade")
      .select("auto_verdict, verdict")
      .eq("run_id", id)
      .eq("decided_by", "human")
      .not("auto_verdict", "is", null);
    if (error) return badRequest(error.message);
    return ok({ grades: data });
  }

  const { paginated, limit, offset } = paginationParams(url);
  let query = auth.supabase
    .from("grade")
    .select(
      "id, golden_case_id, actual_output, verdict, auto_verdict, score, scores, decided_by, note, golden_case(input, known_good)",
      paginated ? { count: "exact" } : {},
    )
    .eq("run_id", id)
    .order("created_at", { ascending: true });
  if (paginated) query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return badRequest(error.message);
  return ok({ grades: data, total: count ?? data.length });
}
