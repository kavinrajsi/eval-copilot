import { badRequest, ok, requireUser } from "@/lib/api";
import { gradeText, judgeImageByLLM, suggestImageFailure } from "@/lib/grading";

const IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ~4MB decoded

// GET /api/features/:id/quick-test — saved quick tests for this feature, newest first.
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("quick_test")
    .select("id, kind, content, verdict, score, decided_by, note, created_at")
    .eq("feature_id", id)
    .order("created_at", { ascending: false });

  if (error) return badRequest(error.message);
  return ok({ quick_tests: data });
}

// DELETE /api/features/:id/quick-test?id=... — remove a saved quick test.
export async function DELETE(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  await params; // feature id not needed; RLS + the row id scope the delete
  const testId = new URL(request.url).searchParams.get("id");
  if (!testId) return badRequest("id is required");

  const { error } = await auth.supabase.from("quick_test").delete().eq("id", testId);
  if (error) return badRequest(error.message);
  return ok({ deleted: testId });
}

// POST /api/features/:id/quick-test — grade one piece of content against the
// feature's latest rubric and SAVE the result. No golden case / known-good:
// machine rules decide on their own; with no machine rules the rubric's
// grader_mode runs the fuzzy path against the plain-English rule text. An image
// can't be checked by machine rules (they can't see pixels), so it always goes
// to the vision model per grader_mode.
// Body: { content?, image?: { data, media_type } }
export async function POST(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  const image = body.image && typeof body.image === "object" ? body.image : null;
  if (!content.trim() && !image) return badRequest("content or image is required");

  const { data: rubric, error } = await supabase
    .from("rubric")
    .select("rule_text, rules, grader_mode, criteria, pass_threshold")
    .eq("feature_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!rubric) return badRequest("This feature has no rubric yet — save one first.");

  // Feature-level reference doc, fed to the AI grader as context.
  const { data: feature } = await supabase
    .from("feature")
    .select("knowledge")
    .eq("id", id)
    .maybeSingle();

  const ctx = {
    rules: rubric.rules ?? [],
    ruleText: rubric.rule_text ?? "",
    graderMode: rubric.grader_mode ?? "suggest",
    criteria: rubric.criteria ?? [],
    threshold: rubric.pass_threshold ?? 70,
    knowledge: feature?.knowledge ?? "",
  };

  let result;
  let kind = "text";
  let savedContent = content;
  if (image) {
    // Vision path: machine rules can't see pixels, so always use the model.
    const mediaType = image.media_type;
    if (!IMAGE_MEDIA_TYPES.has(mediaType)) {
      return badRequest("image must be PNG, JPEG, WebP, or GIF");
    }
    // Strip a data: URL prefix if the client sent one.
    const data = String(image.data ?? "").replace(/^data:[^;]+;base64,/, "");
    if (!data) return badRequest("image data is required");
    // Rough decoded-size guard (base64 is ~4/3 the byte size).
    if (data.length * 0.75 > MAX_IMAGE_BYTES) {
      return badRequest("image is too large (max ~4MB)");
    }
    kind = "image";
    // We don't persist the image bytes — just a short descriptor for history.
    savedContent = `(image: ${mediaType})`;
    result =
      ctx.graderMode === "judge"
        ? await judgeImageByLLM(data, mediaType, ctx.ruleText, ctx.knowledge)
        : await suggestImageFailure(data, mediaType, ctx.ruleText, ctx.knowledge);
  } else {
    // Text path: same Move 3 dispatch as a real run, minus known-good.
    result = await gradeText(content, "", ctx);
  }

  // Save the result (no run / golden case — this is the ad-hoc Quick test log).
  const { data: saved, error: saveErr } = await supabase
    .from("quick_test")
    .insert({
      feature_id: id,
      kind,
      content: savedContent,
      verdict: result.verdict ?? null,
      score: result.score ?? null,
      decided_by: result.decided_by,
      note: result.note ?? null,
    })
    .select("id, kind, content, verdict, score, decided_by, note, created_at")
    .single();
  if (saveErr) return badRequest(saveErr.message);

  return ok({ result, saved });
}
