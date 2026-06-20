import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import FeatureWorkspace from "@/app/dashboard/[featureId]/feature-workspace";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function FeaturePage({ params }) {
  const { featureId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: feature } = await supabase
    .from("feature")
    .select("id, name, feature_type")
    .eq("id", featureId)
    .maybeSingle();

  if (!feature) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/dashboard">← All features</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{feature.name}</h1>
        {feature.feature_type ? (
          <p className="text-muted-foreground text-sm">{feature.feature_type}</p>
        ) : null}
      </div>
      <FeatureWorkspace featureId={feature.id} />
    </div>
  );
}
