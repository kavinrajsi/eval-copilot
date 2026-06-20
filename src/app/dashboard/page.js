import Link from "next/link";
import { redirect } from "next/navigation";

import { EvalChart } from "@/components/eval-chart";
import { FeaturesTable } from "@/components/features-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { Walkthrough } from "@/components/walkthrough";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { dashboardTour } from "@/lib/tours";

function rate(pass, total) {
  return total ? Math.round((pass / total) * 100) : null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS-scoped reads. Only feature/run ROWS are fetched (small); case and grade
  // tallies use count queries so a feature with thousands of rows isn't pulled.
  const [{ data: features }, { data: runs }] = await Promise.all([
    supabase
      .from("feature")
      .select("id, name, feature_type, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("run")
      .select("id, feature_id, label, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const featureList = features ?? [];
  const runList = runs ?? [];

  // Per-feature golden-case counts (count only, no rows).
  const caseCountEntries = await Promise.all(
    featureList.map(async (f) => {
      const { count } = await supabase
        .from("golden_case")
        .select("id", { count: "exact", head: true })
        .eq("feature_id", f.id);
      return [f.id, count ?? 0];
    }),
  );
  const casesByFeature = new Map(caseCountEntries);
  const totalCases = [...casesByFeature.values()].reduce((a, b) => a + b, 0);

  // Per-run pass/total counts (two count queries each, no rows).
  const runStatEntries = await Promise.all(
    runList.map(async (r) => {
      const [{ count: total }, { count: pass }] = await Promise.all([
        supabase.from("grade").select("id", { count: "exact", head: true }).eq("run_id", r.id),
        supabase
          .from("grade")
          .select("id", { count: "exact", head: true })
          .eq("run_id", r.id)
          .eq("verdict", "pass"),
      ]);
      return [r.id, { pass: pass ?? 0, total: total ?? 0 }];
    }),
  );
  const byRun = new Map(runStatEntries);

  // KPIs
  let totalPass = 0;
  let totalGrades = 0;
  for (const { pass, total } of byRun.values()) {
    totalPass += pass;
    totalGrades += total;
  }
  const passRate = rate(totalPass, totalGrades) ?? 0;

  // Chart: pass rate per run, oldest → newest
  const chartData = runList.map((r) => {
    const c = byRun.get(r.id) ?? { pass: 0, total: 0 };
    return {
      name: r.label ?? new Date(r.created_at).toLocaleDateString(),
      passRate: rate(c.pass, c.total) ?? 0,
      pass: c.pass,
      fail: c.total - c.pass,
    };
  });

  // Table rows: per-feature counts + latest-run pass rate
  const runsByFeature = new Map();
  for (const r of runList) {
    const arr = runsByFeature.get(r.feature_id) ?? [];
    arr.push(r);
    runsByFeature.set(r.feature_id, arr);
  }
  const rows = featureList.map((f) => {
    const fRuns = runsByFeature.get(f.id) ?? [];
    const latest = fRuns[fRuns.length - 1]; // runs are ascending by created_at
    const c = latest ? byRun.get(latest.id) : null;
    return {
      id: f.id,
      name: f.name,
      type: f.feature_type,
      cases: casesByFeature.get(f.id) ?? 0,
      runs: fRuns.length,
      latestPassRate: c ? rate(c.pass, c.total) : null,
    };
  });

  return (
    <>
      <SiteHeader title="Dashboard">
        <Walkthrough steps={dashboardTour} storageKey="ec-tour-dashboard-v1" />
        <Link
          href="/dashboard/new"
          data-tour="new-feature"
          className={buttonVariants()}
        >
          New feature
        </Link>
      </SiteHeader>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div data-tour="kpis">
          <SectionCards
            totalFeatures={featureList.length}
            totalCases={totalCases}
            totalRuns={runList.length}
            passRate={passRate}
          />
        </div>
        <div data-tour="chart">
          <EvalChart data={chartData} />
        </div>
        <div data-tour="features">
          <FeaturesTable rows={rows} />
        </div>
      </div>
    </>
  );
}
