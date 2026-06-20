import { badRequest, ok, requireUser } from "@/lib/api";
import { gradeByRule } from "@/lib/grading";

// GET /api/features/:id/runs — list runs for this feature (newest first)
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("run")
    .select("id, label, created_at")
    .eq("feature_id", id)
    .order("created_at", { ascending: false });

  if (error) return badRequest(error.message);
  return ok({ runs: data });
}

// POST /api/features/:id/runs — create a run and grade every supplied output.
// Body: { label, outputs: [{ golden_case_id, actual_output }] }
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const outputs = Array.isArray(body.outputs) ? body.outputs : [];
  if (!outputs.length) return badRequest("outputs is required");

  // Latest rubric supplies the machine rules.
  const { data: rubric } = await supabase
    .from("rubric")
    .select("rules")
    .eq("feature_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rules = rubric?.rules ?? [];

  // Known-good answers for the cases being graded.
  const caseIds = outputs.map((o) => o.golden_case_id);
  const { data: cases, error: caseErr } = await supabase
    .from("golden_case")
    .select("id, known_good")
    .in("id", caseIds);
  if (caseErr) return badRequest(caseErr.message);

  const knownGoodById = new Map((cases ?? []).map((c) => [c.id, c.known_good]));

  // Create the run.
  const { data: run, error: runErr } = await supabase
    .from("run")
    .insert({ feature_id: id, label: body.label ?? null })
    .select("id, label, created_at")
    .single();
  if (runErr) return badRequest(runErr.message);

  // Grade each output by rule. The verdict is the rule's — never the AI's.
  const gradeRows = outputs.map((o) => {
    const result = gradeByRule(o.actual_output, knownGoodById.get(o.golden_case_id), rules);
    return {
      run_id: run.id,
      golden_case_id: o.golden_case_id,
      actual_output: o.actual_output ?? "",
      verdict: result.verdict,
      decided_by: result.decided_by,
      note: result.note ?? null,
    };
  });

  const { data: grades, error: gradeErr } = await supabase
    .from("grade")
    .insert(gradeRows)
    .select("golden_case_id, verdict, decided_by, note");
  if (gradeErr) return badRequest(gradeErr.message);

  const pass = grades.filter((g) => g.verdict === "pass").length;
  return ok(
    {
      run_id: run.id,
      summary: { pass, fail: grades.length - pass, total: grades.length },
      grades,
    },
    201,
  );
}
