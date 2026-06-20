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

  // RLS-scoped reads; aggregate in JS.
  const [{ data: features }, { data: cases }, { data: runs }, { data: grades }] =
    await Promise.all([
      supabase
        .from("feature")
        .select("id, name, feature_type, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("golden_case").select("feature_id"),
      supabase
        .from("run")
        .select("id, feature_id, label, created_at")
        .order("created_at", { ascending: true }),
      supabase.from("grade").select("run_id, verdict"),
    ]);

  const featureList = features ?? [];
  const caseList = cases ?? [];
  const runList = runs ?? [];
  const gradeList = grades ?? [];

  // grades grouped by run
  const byRun = new Map();
  for (const g of gradeList) {
    const r = byRun.get(g.run_id) ?? { pass: 0, total: 0 };
    r.total += 1;
    if (g.verdict === "pass") r.pass += 1;
    byRun.set(g.run_id, r);
  }

  // KPIs
  const totalPass = gradeList.filter((g) => g.verdict === "pass").length;
  const passRate = rate(totalPass, gradeList.length) ?? 0;

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
  const casesByFeature = new Map();
  for (const c of caseList) {
    casesByFeature.set(c.feature_id, (casesByFeature.get(c.feature_id) ?? 0) + 1);
  }
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
            totalCases={caseList.length}
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
