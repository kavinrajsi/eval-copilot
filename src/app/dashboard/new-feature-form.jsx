"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewFeatureForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, feature_type: type || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create feature");
      return;
    }
    setName("");
    setType("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New feature</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SEO Content Generator"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type (optional)</Label>
            <Input
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="text / image / classifier"
            />
          </div>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Adding…" : "Add feature"}
          </Button>
        </form>
        {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
