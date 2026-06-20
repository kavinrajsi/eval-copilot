import { badRequest, ok, requireUser } from "@/lib/api";

// PATCH /api/grades/:id — a human confirms/overrides a fuzzy verdict.
// This is the person's side of the boundary: decided_by becomes 'human'.
// Body: { verdict: 'pass'|'fail', note? }
export async function PATCH(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  if (body.verdict !== "pass" && body.verdict !== "fail") {
    return badRequest("verdict must be 'pass' or 'fail'");
  }

  const { data, error } = await auth.supabase
    .from("grade")
    .update({ verdict: body.verdict, decided_by: "human", note: body.note ?? null })
    .eq("id", id)
    .select("id, golden_case_id, verdict, decided_by, note")
    .single();

  if (error) return badRequest(error.message);
  return ok({ grade: data });
}
