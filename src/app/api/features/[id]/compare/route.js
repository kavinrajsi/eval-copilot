import { badRequest, ok, requireUser } from "@/lib/api";

// GET /api/features/:id/compare?run1=&run2= — case-by-case diff of two runs.
// The comparison key is golden_case_id: the same case across both runs.
export async function GET(request, { params }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const run1 = searchParams.get("run1");
  const run2 = searchParams.get("run2");
  if (!run1 || !run2) return badRequest("run1 and run2 are required");

  // RLS scopes by user; this additionally enforces the feature boundary so two
  // runs from different features can't be compared.
  const { data: runRows, error: runErr } = await auth.supabase
    .from("run")
    .select("id")
    .eq("feature_id", id)
    .in("id", [run1, run2]);
  if (runErr) return badRequest(runErr.message);
  const runIds = new Set((runRows ?? []).map((r) => r.id));
  if (!runIds.has(run1) || !runIds.has(run2)) {
    return badRequest("Both runs must belong to this feature");
  }

  const { data, error } = await auth.supabase
    .from("grade")
    .select("run_id, golden_case_id, verdict, note, golden_case(input)")
    .in("run_id", [run1, run2]);
  if (error) return badRequest(error.message);

  const byCase = new Map();
  for (const g of data) {
    const entry = byCase.get(g.golden_case_id) ?? {
      golden_case_id: g.golden_case_id,
      input: g.golden_case?.input ?? null,
      run1: null,
      run2: null,
    };
    if (g.run_id === run1) entry.run1 = g.verdict;
    if (g.run_id === run2) entry.run2 = g.verdict;
    byCase.set(g.golden_case_id, entry);
  }

  const cases = [...byCase.values()].map((c) => ({
    ...c,
    change:
      c.run1 === c.run2
        ? "same"
        : c.run1 === "fail" && c.run2 === "pass"
          ? "fixed"
          : c.run1 === "pass" && c.run2 === "fail"
            ? "broke"
            : "changed",
  }));

  const summary = {
    fixed: cases.filter((c) => c.change === "fixed").length,
    broke: cases.filter((c) => c.change === "broke").length,
    same: cases.filter((c) => c.change === "same").length,
  };

  return ok({ run1, run2, summary, cases });
}
