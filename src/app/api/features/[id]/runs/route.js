import { badRequest, ok, requireUser } from "@/lib/api";
import {
  gradeByRule,
  isMachineCheckable,
  judgeByLLM,
  judgeMultiByLLM,
  submitJudgeBatch,
  suggestPossibleFailure,
} from "@/lib/grading";

const BATCH_THRESHOLD = 50; // judge runs larger than this go async via Batches

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

  // Latest rubric supplies the machine rules, plain-English text, and grader mode.
  const { data: rubric } = await supabase
    .from("rubric")
    .select("rule_text, rules, grader_mode, criteria, pass_threshold")
    .eq("feature_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rules = rubric?.rules ?? [];
  const ruleText = rubric?.rule_text ?? "";
  const graderMode = rubric?.grader_mode ?? "suggest";
  const criteria = rubric?.criteria ?? [];
  const threshold = rubric?.pass_threshold ?? 70;

  // Feature-level reference doc, fed to the AI grader as context (fuzzy path only).
  const { data: feature } = await supabase
    .from("feature")
    .select("knowledge")
    .eq("id", id)
    .maybeSingle();
  const knowledge = feature?.knowledge ?? "";

  // Known-good answers for the cases being graded.
  const caseIds = outputs.map((o) => o.golden_case_id);
  const { data: cases, error: caseErr } = await supabase
    .from("golden_case")
    .select("id, known_good")
    .in("id", caseIds);
  if (caseErr) return badRequest(caseErr.message);

  const knownGoodById = new Map((cases ?? []).map((c) => [c.id, c.known_good]));

  // Large judge runs grade asynchronously via the Anthropic Batches API: create
  // the run in a 'grading' state with placeholder grades and return immediately;
  // the /runs/:id/status poll writes the verdicts once the batch ends. Falls
  // through to synchronous grading if the batch can't be submitted.
  const fuzzyJudge = !isMachineCheckable(rules) && graderMode === "judge";
  if (fuzzyJudge && outputs.length > BATCH_THRESHOLD && process.env.ANTHROPIC_API_KEY) {
    const items = outputs.map((o) => ({
      golden_case_id: o.golden_case_id,
      actual_output: o.actual_output ?? "",
      known_good: knownGoodById.get(o.golden_case_id),
    }));
    let batchId = null;
    try {
      batchId = await submitJudgeBatch(items, { ruleText, knowledge, criteria, threshold });
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
      for (let k = 0; k < placeholders.length; k += 500) {
        const { error } = await supabase.from("grade").insert(placeholders.slice(k, k + 500));
        if (error) return badRequest(error.message);
      }

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

  // Move 3 boundary. Machine rules always decide deterministically
  // (decided_by 'rule'). With no machine rules, the rubric's grader_mode governs
  // the fuzzy path: 'judge' lets the AI score pass/fail (decided_by 'llm_judge',
  // human-overridable); 'suggest' (default) only flags a possible failure
  // (decided_by 'llm_suggested', verdict null) for a human to confirm.
  const machine = isMachineCheckable(rules);
  async function gradeOne(o) {
    const knownGood = knownGoodById.get(o.golden_case_id);
    let result;
    if (machine) {
      result = gradeByRule(o.actual_output, knownGood, rules);
    } else if (graderMode === "judge" && criteria.length) {
      result = await judgeMultiByLLM(o.actual_output, knownGood, ruleText, knowledge, criteria, threshold);
    } else if (graderMode === "judge") {
      result = await judgeByLLM(o.actual_output, knownGood, ruleText, knowledge);
    } else {
      result = await suggestPossibleFailure(o.actual_output, knownGood, knowledge);
    }
    return {
      run_id: run.id,
      golden_case_id: o.golden_case_id,
      actual_output: o.actual_output ?? "",
      verdict: result.verdict ?? null,
      // Preserve the machine's verdict so a later human override can be
      // compared against it (confusion matrix). Null for suggest-only cases.
      auto_verdict: result.verdict ?? null,
      score: result.score ?? null,
      scores: result.scores ?? null,
      decided_by: result.decided_by,
      note: result.note ?? null,
    };
  }

  // Grade with bounded concurrency (caps in-flight model calls on the AI paths;
  // machine rules are sync so this is just a tidy loop for them).
  const CONCURRENCY = 8;
  const gradeRows = [];
  for (let k = 0; k < outputs.length; k += CONCURRENCY) {
    const batch = await Promise.all(outputs.slice(k, k + CONCURRENCY).map(gradeOne));
    gradeRows.push(...batch);
  }

  // Insert grades in chunks so a large run stays under payload/row limits.
  const CHUNK = 500;
  let grades = [];
  for (let k = 0; k < gradeRows.length; k += CHUNK) {
    const { data, error } = await supabase
      .from("grade")
      .insert(gradeRows.slice(k, k + CHUNK))
      .select("golden_case_id, verdict, decided_by, note");
    if (error) return badRequest(error.message);
    grades = grades.concat(data);
  }

  const pass = grades.filter((g) => g.verdict === "pass").length;
  const fail = grades.filter((g) => g.verdict === "fail").length;
  return ok(
    {
      run_id: run.id,
      summary: {
        pass,
        fail,
        pending: grades.length - pass - fail,
        total: grades.length,
      },
      grades,
    },
    201,
  );
}
