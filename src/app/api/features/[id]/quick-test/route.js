import { badRequest, ok, requireUser } from "@/lib/api";
import {
  gradeByRule,
  isMachineCheckable,
  judgeByLLM,
  judgeImageByLLM,
  suggestImageFailure,
  suggestPossibleFailure,
} from "@/lib/grading";

const IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ~4MB decoded

// POST /api/features/:id/quick-test — grade one piece of content against the
// feature's latest rubric WITHOUT saving anything. No golden case / known-good:
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

  // Feature-level reference doc, fed to the AI grader as context.
  const { data: feature } = await supabase
    .from("feature")
    .select("knowledge")
    .eq("id", id)
    .maybeSingle();
  const knowledge = feature?.knowledge ?? "";

  let result;
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
    result =
      graderMode === "judge"
        ? await judgeImageByLLM(data, mediaType, ruleText, knowledge)
        : await suggestImageFailure(data, mediaType, ruleText, knowledge);
  } else if (isMachineCheckable(rules)) {
    // Same Move 3 boundary as a real run, minus persistence and known-good.
    result = gradeByRule(content, "", rules);
  } else if (graderMode === "judge") {
    result = await judgeByLLM(content, "", ruleText, knowledge);
  } else {
    result = await suggestPossibleFailure(content, "", knowledge);
  }

  return ok({ result });
}
