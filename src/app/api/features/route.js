import { badRequest, ok, requireUser } from "@/lib/api";

// GET /api/features — list the signed-in user's features
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("feature")
    .select("id, name, feature_type, created_at")
    .order("created_at", { ascending: false });

  if (error) return badRequest(error.message);
  return ok({ features: data });
}

// POST /api/features — create a feature
export async function POST(request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const name = body.name?.trim();
  if (!name) return badRequest("name is required");

  const { data, error } = await auth.supabase
    .from("feature")
    .insert({ name, feature_type: body.feature_type ?? null })
    .select("id, name, feature_type, created_at")
    .single();

  if (error) return badRequest(error.message);
  return ok({ feature: data }, 201);
}
