import { badRequest, ok, requireUser } from "@/lib/api";
import {
  gradeByRule,
  isMachineCheckable,
  judgeByLLM,
  suggestPossibleFailure,
} from "@/lib/grading";

// POST /api/features/:id/quick-test — grade one piece of content against the
// feature's latest rubric WITHOUT saving anything. No golden case / known-good:
// machine rules decide on their own; with no machine rules the rubric's
// grader_mode runs the fuzzy path against the plain-English rule text.
// Body: { content }
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return badRequest("content is required");

  const { data: rubric, error } = await supabase
    .from("rubric")
    .select("rule_text, rules, grader_mode")
    .eq("feature_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!rubric) return badRequest("This feature has no rubric yet — save one first.");

  const rules = rubric.rules ?? [];
  const ruleText = rubric.rule_text ?? "";
  const graderMode = rubric.grader_mode ?? "suggest";

  // Same Move 3 boundary as a real run, minus persistence and known-good.
  let result;
  if (isMachineCheckable(rules)) {
    result = gradeByRule(content, "", rules);
  } else if (graderMode === "judge") {
    result = await judgeByLLM(content, "", ruleText);
  } else {
    result = await suggestPossibleFailure(content, "");
  }

  return ok({ result });
}
