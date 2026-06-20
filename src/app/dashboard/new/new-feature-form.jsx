"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewFeatureForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, feature_type: type || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      router.push(`/dashboard/${body.feature.id}`);
    } catch (err) {
      toast.error(`Could not create feature: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New feature</CardTitle>
        <CardDescription>
          Name the AI feature you want to evaluate. You can add golden cases and
          a rubric next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Brand Rulebook Classifier"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type (optional)</Label>
            <Input
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="classifier"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create feature"}
            </Button>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "ghost" })}
            >
              Cancel
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
