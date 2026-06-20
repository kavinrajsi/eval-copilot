import { badRequest, ok, requireUser } from "@/lib/api";
import { fetchBatchResults } from "@/lib/grading";

// GET /api/runs/:id/status — for a run grading via an async batch, poll the
// batch; when it ends, write the real verdicts/scores and flip status to 'done'.
// Returns { status: 'grading' | 'done' | ... }.
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const { data: run, error } = await supabase
    .from("run")
    .select("id, status, batch_id, feature_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!run) return badRequest("run not found");
  if (run.status !== "grading" || !run.batch_id) return ok({ status: run.status ?? "done" });

  const { data: rubric } = await supabase
    .from("rubric")
    .select("pass_threshold")
    .eq("feature_id", run.feature_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const res = await fetchBatchResults(run.batch_id, rubric?.pass_threshold ?? 70);
  if (res.status !== "done") return ok({ status: res.status });

  // Write each case's result onto its placeholder grade, bounded-parallel.
  const entries = [...res.results];
  const POOL = 8;
  for (let k = 0; k < entries.length; k += POOL) {
    const errs = await Promise.all(
      entries.slice(k, k + POOL).map(([gcId, r]) =>
        supabase
          .from("grade")
          .update({
            verdict: r.verdict ?? null,
            auto_verdict: r.verdict ?? null,
            score: r.score ?? null,
            scores: r.scores ?? null,
            decided_by: r.decided_by ?? "llm_judge",
            note: r.note ?? null,
          })
          .eq("run_id", id)
          .eq("golden_case_id", gcId)
          .then(({ error: e }) => e),
      ),
    );
    const firstErr = errs.find(Boolean);
    if (firstErr) return badRequest(firstErr.message);
  }

  await supabase.from("run").update({ status: "done" }).eq("id", id);
  return ok({ status: "done" });
}
