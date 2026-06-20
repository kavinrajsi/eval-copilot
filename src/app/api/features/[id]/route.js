import { badRequest, ok, requireUser } from "@/lib/api";

// GET /api/features/:id — the feature record, including its knowledge doc.
export async function GET(_request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await auth.supabase
    .from("feature")
    .select("id, name, feature_type, knowledge")
    .eq("id", id)
    .maybeSingle();

  if (error) return badRequest(error.message);
  return ok({ feature: data });
}

// PATCH /api/features/:id — update the feature's knowledge doc.
// Body: { knowledge }
export async function PATCH(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  if (typeof body.knowledge !== "string") {
    return badRequest("knowledge must be a string");
  }

  const { data, error } = await auth.supabase
    .from("feature")
    .update({ knowledge: body.knowledge })
    .eq("id", id)
    .select("id, name, feature_type, knowledge")
    .single();

  if (error) return badRequest(error.message);
  return ok({ feature: data });
}
