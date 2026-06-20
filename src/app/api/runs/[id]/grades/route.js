import { badRequest, ok, requireUser } from "@/lib/api";

// GET /api/runs/:id/grades — grades for a run, with each case's input
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("grade")
    .select("id, golden_case_id, actual_output, verdict, decided_by, note, golden_case(input, known_good)")
    .eq("run_id", id)
    .order("created_at", { ascending: true });

  if (error) return badRequest(error.message);
  return ok({ grades: data });
}
