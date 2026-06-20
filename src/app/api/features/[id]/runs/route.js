import { badRequest, insertChunked, ok, requireUser } from "@/lib/api";
import { gradeText, isMachineCheckable, submitJudgeBatch } from "@/lib/grading";

const BATCH_THRESHOLD = 50; // judge runs larger than this go async via Batches
const CONCURRENCY = 8; // in-flight model calls on the sync path

// GET /api/features/:id/runs — list runs for this feature (newest first)
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("run")
    .select("id, label, created_at, status")
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

  // Latest rubric, the feature's knowledge, and the cases' known-good answers —
  // all independent reads, fetched together.
  const caseIds = outputs.map((o) => o.golden_case_id);
  const [{ data: rubric }, { data: feature }, { data: cases, error: caseErr }] = await Promise.all([
    supabase
      .from("rubric")
      .select("rule_text, rules, grader_mode, criteria, pass_threshold")
      .eq("feature_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("feature").select("knowledge").eq("id", id).maybeSingle(),
    supabase.from("golden_case").select("id, known_good").in("id", caseIds),
  ]);
  if (caseErr) return badRequest(caseErr.message);

  const ctx = {
    rules: rubric?.rules ?? [],
    ruleText: rubric?.rule_text ?? "",
    graderMode: rubric?.grader_mode ?? "suggest",
    criteria: rubric?.criteria ?? [],
    threshold: rubric?.pass_threshold ?? 70,
    knowledge: feature?.knowledge ?? "",
  };
  const knownGoodById = new Map((cases ?? []).map((c) => [c.id, c.known_good]));

  // Large judge runs grade asynchronously via the Anthropic Batches API: create
  // the run in a 'grading' state with placeholder grades and return immediately;
  // the /runs/:id/status poll writes the verdicts once the batch ends. Falls
  // through to synchronous grading if the batch can't be submitted.
  const fuzzyJudge = !isMachineCheckable(ctx.rules) && ctx.graderMode === "judge";
  if (fuzzyJudge && outputs.length > BATCH_THRESHOLD && process.env.ANTHROPIC_API_KEY) {
    const items = outputs.map((o) => ({
      golden_case_id: o.golden_case_id,
      actual_output: o.actual_output ?? "",
      known_good: knownGoodById.get(o.golden_case_id),
    }));
    let batchId = null;
    try {
      batchId = await submitJudgeBatch(items, {
        ruleText: ctx.ruleText,
        knowledge: ctx.knowledge,
        criteria: ctx.criteria,
        threshold: ctx.threshold,
      });
    } catch {
      batchId = null; // fall through to sync
    }
    if (batchId) {
      const { data: run, error: runErr } = await supabase
        .from("run")
        .insert({ feature_id: id, label: body.label ?? null, status: "grading", batch_id: batchId })
        .select("id, label, created_at, status")
        .single();
      if (runErr) return badRequest(runErr.message);

      const placeholders = items.map((it) => ({
        run_id: run.id,
        golden_case_id: it.golden_case_id,
        actual_output: it.actual_output,
        verdict: null,
        decided_by: "llm_judge",
        note: "grading…",
      }));
      const { error: phErr } = await insertChunked(supabase, "grade", placeholders);
      if (phErr) return badRequest(phErr.message);

      return ok(
        {
          run_id: run.id,
          status: "grading",
          summary: { pass: 0, fail: 0, pending: items.length, total: items.length },
        },
        201,
      );
    }
  }

  // Create the run (synchronous grading path).
  const { data: run, error: runErr } = await supabase
    .from("run")
    .insert({ feature_id: id, label: body.label ?? null })
    .select("id, label, created_at")
    .single();
  if (runErr) return badRequest(runErr.message);

  // gradeText owns the Move 3 dispatch (machine rule → judge/multi → suggest);
  // auto_verdict preserves the machine verdict for the later confusion matrix.
  async function gradeOne(o) {
    const result = await gradeText(o.actual_output, knownGoodById.get(o.golden_case_id), ctx);
    return {
      run_id: run.id,
      golden_case_id: o.golden_case_id,
      actual_output: o.actual_output ?? "",
      verdict: result.verdict ?? null,
      auto_verdict: result.verdict ?? null,
      score: result.score ?? null,
      scores: result.scores ?? null,
      decided_by: result.decided_by,
      note: result.note ?? null,
    };
  }

  // Grade with bounded concurrency (caps in-flight model calls on the AI paths).
  const gradeRows = [];
  for (let k = 0; k < outputs.length; k += CONCURRENCY) {
    const batch = await Promise.all(outputs.slice(k, k + CONCURRENCY).map(gradeOne));
    gradeRows.push(...batch);
  }

  const { data: grades, error: gradeErr } = await insertChunked(
    supabase,
    "grade",
    gradeRows,
    "golden_case_id, verdict, decided_by, note",
  );
  if (gradeErr) return badRequest(gradeErr.message);

  const pass = grades.filter((g) => g.verdict === "pass").length;
  const fail = grades.filter((g) => g.verdict === "fail").length;
  return ok(
    {
      run_id: run.id,
      summary: { pass, fail, pending: grades.length - pass - fail, total: grades.length },
      grades,
    },
    201,
  );
}
