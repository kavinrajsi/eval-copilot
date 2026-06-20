import Link from "next/link";
import { redirect } from "next/navigation";

import { signout } from "@/app/login/actions";
import NewFeatureForm from "@/app/dashboard/new-feature-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: features } = await supabase
    .from("feature")
    .select("id, name, feature_type, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Eval Copilot</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
        <form action={signout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <div className="grid gap-6">
        <NewFeatureForm />

        <Card>
          <CardHeader>
            <CardTitle>My Features</CardTitle>
            <CardDescription>
              Each feature has a golden set, a rubric, and runs you can compare.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {features?.length ? (
              features.map((f) => (
                <Link
                  key={f.id}
                  href={`/dashboard/${f.id}`}
                  className="hover:bg-accent flex items-center justify-between rounded-md border px-4 py-3 transition-colors"
                >
                  <span className="font-medium">{f.name}</span>
                  {f.feature_type ? (
                    <Badge variant="secondary">{f.feature_type}</Badge>
                  ) : null}
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No features yet — create one above to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
