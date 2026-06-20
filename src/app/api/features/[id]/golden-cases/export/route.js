import { requireUser } from "@/lib/api";
import { toCsv } from "@/lib/csv";

// GET /api/features/:id/golden-cases/export?format=csv|json — download the
// feature's golden set as a file (cookie-authed, RLS-scoped).
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  const { data, error } = await auth.supabase
    .from("golden_case")
    .select("input, known_good")
    .eq("feature_id", id)
    .order("created_at", { ascending: true });

  if (error) return new Response(error.message, { status: 400 });
  const cases = data ?? [];

  if (format === "json") {
    return new Response(JSON.stringify(cases, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="golden-cases.json"',
      },
    });
  }

  const csv = toCsv([["input", "known_good"], ...cases.map((c) => [c.input, c.known_good])]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="golden-cases.csv"',
    },
  });
}
