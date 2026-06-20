"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { isMachineCheckable } from "@/lib/grading";
import { parseCsv } from "@/lib/csv";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// Fetch JSON and surface API/network errors instead of failing silently.
// Throws on a non-2xx response so callers can toast and recover.
async function jsonFetch(url, opts) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

const RULE_TYPES = [
  "max_length",
  "min_length",
  "must_not_contain",
  "must_contain",
  "exact_match",
  "count_equals",
  "rouge_l",
  "jaccard",
];

function Verdict({ value }) {
  // A null/empty verdict means pending — the AI suggested, a human must confirm.
  if (!value) return <Badge variant="outline">Needs review</Badge>;
  return (
    <Badge variant={value === "pass" ? "secondary" : "destructive"}>
      {value.toUpperCase()}
    </Badge>
  );
}

export default function FeatureWorkspace({ featureId }) {
  const [feature, setFeature] = useState(null);
  const [cases, setCases] = useState([]);
  const [rubric, setRubric] = useState(null);
  const [runs, setRuns] = useState([]);

  const base = `/api/features/${featureId}`;

  const loadAll = useCallback(async () => {
    try {
      const [f, c, r, ru] = await Promise.all([
        jsonFetch(base),
        jsonFetch(`${base}/golden-cases`),
        jsonFetch(`${base}/rubric`),
        jsonFetch(`${base}/runs`),
      ]);
      setFeature(f.feature ?? null);
      setCases(c.golden_cases ?? []);
      setRubric(r.rubric ?? null);
      setRuns(ru.runs ?? []);
    } catch (e) {
      toast.error(`Couldn't load this feature: ${e.message}`);
    }
  }, [base]);

  useEffect(() => {
    // Load the feature's data once on mount; loadAll setStates after fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  return (
    <Tabs defaultValue="knowledge">
      <TabsList className="mb-4 flex-wrap">
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        <TabsTrigger value="golden">Golden Set</TabsTrigger>
        <TabsTrigger value="rubric">Rubric</TabsTrigger>
        <TabsTrigger value="run">Run</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
        <TabsTrigger value="quick-test">Quick test</TabsTrigger>
      </TabsList>

      <TabsContent value="knowledge">
        <Knowledge key={feature?.id ?? "f"} base={base} feature={feature} onChange={loadAll} />
      </TabsContent>
      <TabsContent value="golden">
        <GoldenSet base={base} cases={cases} onChange={loadAll} />
      </TabsContent>
      <TabsContent value="rubric">
        <Rubric key={rubric?.id ?? "new"} base={base} rubric={rubric} onChange={loadAll} />
      </TabsContent>
      <TabsContent value="run">
        <RunPanel base={base} cases={cases} rubric={rubric} onRun={loadAll} />
      </TabsContent>
      <TabsContent value="results">
        <Results runs={runs} onChange={loadAll} />
      </TabsContent>
      <TabsContent value="compare">
        <Compare base={base} runs={runs} />
      </TabsContent>
      <TabsContent value="quick-test">
        <QuickTest base={base} rubric={rubric} />
      </TabsContent>
    </Tabs>
  );
}

// --- Knowledge ------------------------------------------------------------

// A per-feature reference doc (brand guidelines, source material, context) the
// AI grader reads. Comes before the Golden Set: you set the reference, then
// write the cases. Keyed on feature id by the parent so initial state comes
// from the prop once it loads.
function Knowledge({ base, feature, onChange }) {
  const [knowledge, setKnowledge] = useState(feature?.knowledge ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await jsonFetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge }),
      });
      onChange();
    } catch (err) {
      toast.error(`Couldn't save knowledge: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge</CardTitle>
        <CardDescription>
          The reference the grader reads — paste brand guidelines, source
          material, or context here <em>before</em> you build the golden set. The
          AI uses it on fuzzy and image checks; machine rules ignore it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Reference document</Label>
          <Textarea
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder="e.g. brand voice, palette, banned terms, do/don't rules…"
            className="min-h-64 font-mono text-xs"
          />
        </div>
        <Button onClick={save} disabled={busy} className="justify-self-start">
          {busy ? "Saving…" : "Save knowledge"}
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Golden Set -----------------------------------------------------------

const GOLDEN_PAGE = 50;

function GoldenSet({ base, onChange }) {
  const [input, setInput] = useState("");
  const [knownGood, setKnownGood] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [genCount, setGenCount] = useState(10);
  const [genSeeds, setGenSeeds] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [candidates, setCandidates] = useState([]); // { input, known_good, checked }

  const loadPage = useCallback(async () => {
    try {
      const b = await jsonFetch(
        `${base}/golden-cases?limit=${GOLDEN_PAGE}&offset=${page * GOLDEN_PAGE}`,
      );
      setRows(b.golden_cases ?? []);
      setTotal(b.total ?? 0);
    } catch (e) {
      toast.error(`Couldn't load cases: ${e.message}`);
    }
  }, [base, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage();
  }, [loadPage]);

  async function refresh() {
    await loadPage();
    onChange?.();
  }

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await jsonFetch(`${base}/golden-cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, known_good: knownGood }),
      });
      setInput("");
      setKnownGood("");
      setPage(0);
      await refresh();
    } catch (err) {
      toast.error(`Couldn't add case: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(caseId) {
    try {
      await jsonFetch(`${base}/golden-cases/${caseId}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      toast.error(`Couldn't delete case: ${err.message}`);
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      let cases = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        const arr = JSON.parse(text);
        cases = (Array.isArray(arr) ? arr : []).map((c) => ({
          input: c.input,
          known_good: c.known_good,
        }));
      } else {
        const parsed = parseCsv(text);
        if (!parsed.length) throw new Error("empty file");
        const header = parsed[0].map((h) => h.trim().toLowerCase());
        const iIn = header.indexOf("input");
        const iKg = header.indexOf("known_good");
        if (iIn < 0 || iKg < 0) throw new Error("CSV needs 'input' and 'known_good' headers");
        cases = parsed.slice(1).map((r) => ({ input: r[iIn], known_good: r[iKg] }));
      }
      cases = cases.filter((c) => c.input?.trim() && c.known_good?.trim());
      if (!cases.length) throw new Error("no valid rows (need input + known_good)");

      let inserted = 0;
      for (let k = 0; k < cases.length; k += 500) {
        const r = await jsonFetch(`${base}/golden-cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cases: cases.slice(k, k + 500) }),
        });
        inserted += r.inserted ?? r.golden_cases?.length ?? 0;
      }
      toast.success(`Imported ${inserted} case${inserted === 1 ? "" : "s"}`);
      setPage(0);
      await refresh();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function exportAs(format) {
    const a = document.createElement("a");
    a.href = `${base}/golden-cases/export?format=${format}`;
    a.click();
  }

  async function generate() {
    setGenBusy(true);
    try {
      const b = await jsonFetch(`${base}/golden-cases/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(genCount), seeds: genSeeds }),
      });
      const list = (b.candidates ?? []).map((c) => ({ ...c, checked: true }));
      setCandidates(list);
      if (!list.length) toast.message("No candidates generated.");
    } catch (err) {
      toast.error(`Generate failed: ${err.message}`);
    } finally {
      setGenBusy(false);
    }
  }

  function patchCandidate(i, field, value) {
    setCandidates((prev) => prev.map((c, j) => (j === i ? { ...c, [field]: value } : c)));
  }

  async function saveSelected() {
    const keep = candidates
      .filter((c) => c.checked && c.input.trim() && c.known_good.trim())
      .map((c) => ({ input: c.input, known_good: c.known_good }));
    if (!keep.length) {
      toast.error("Nothing selected to save.");
      return;
    }
    setGenBusy(true);
    try {
      let inserted = 0;
      for (let k = 0; k < keep.length; k += 500) {
        const r = await jsonFetch(`${base}/golden-cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cases: keep.slice(k, k + 500) }),
        });
        inserted += r.inserted ?? r.golden_cases?.length ?? 0;
      }
      toast.success(`Saved ${inserted} case${inserted === 1 ? "" : "s"}`);
      setCandidates([]);
      setPage(0);
      await refresh();
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setGenBusy(false);
    }
  }

  const start = total ? page * GOLDEN_PAGE + 1 : 0;
  const end = Math.min(total, (page + 1) * GOLDEN_PAGE);
  const maxPage = Math.max(0, Math.ceil(total / GOLDEN_PAGE) - 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Golden Set</CardTitle>
        <CardDescription>
          The answer key — write the known-good output <em>before</em> you run.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="gc-import" className="text-xs">Import CSV/JSON</Label>
          <Input
            id="gc-import"
            type="file"
            accept=".csv,.json"
            onChange={onImport}
            disabled={busy}
            className="w-64"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => exportAs("csv")}>
            Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exportAs("json")}>
            Export JSON
          </Button>
          <span className="text-muted-foreground ml-auto text-xs">{total} cases</span>
        </div>
        <p className="text-muted-foreground text-xs">
          CSV needs <code>input</code> and <code>known_good</code> columns; JSON is an array of{" "}
          <code>{`{ input, known_good }`}</code>.
        </p>

        <form onSubmit={add} className="grid gap-3">
          <div className="grid gap-2">
            <Label>Input / brief</Label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Off-brand colour used (pink instead of brand teal)"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Known-good answer</Label>
            <Textarea
              value={knownGood}
              onChange={(e) => setKnownGood(e.target.value)}
              placeholder="FAIL — colour violation"
              required
            />
          </div>
          <Button type="submit" disabled={busy || !input || !knownGood} className="justify-self-start">
            {busy ? "Adding…" : "Add case"}
          </Button>
        </form>

        <div className="grid gap-3 border-t pt-4">
          <Label className="text-sm">Generate cases (AI draft)</Label>
          <p className="text-muted-foreground text-xs">
            The AI drafts candidates from this feature&apos;s Knowledge + rubric.{" "}
            <strong>Review and edit before saving</strong> — an answer key the AI wrote and the
            AI grades is a mirror, not a test.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="number"
              min="1"
              max="200"
              value={genCount}
              onChange={(e) => setGenCount(e.target.value)}
              className="w-20"
            />
            <span className="text-muted-foreground text-xs">cases</span>
            <Button type="button" variant="secondary" onClick={generate} disabled={genBusy}>
              {genBusy ? "Generating…" : "Generate"}
            </Button>
          </div>
          <Textarea
            value={genSeeds}
            onChange={(e) => setGenSeeds(e.target.value)}
            placeholder="Optional seed examples to anchor style (one per line)…"
            className="min-h-16 text-xs"
          />

          {candidates.length ? (
            <div className="grid gap-2">
              <p className="text-sm font-medium">
                {candidates.filter((c) => c.checked).length}/{candidates.length} selected
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-0">Keep</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Known-good</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="align-top">
                        <input
                          type="checkbox"
                          checked={c.checked}
                          onChange={(e) => patchCandidate(i, "checked", e.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Textarea
                          value={c.input}
                          onChange={(e) => patchCandidate(i, "input", e.target.value)}
                          className="min-h-12 text-xs"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Textarea
                          value={c.known_good}
                          onChange={(e) => patchCandidate(i, "known_good", e.target.value)}
                          className="min-h-12 text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex gap-2">
                <Button type="button" onClick={saveSelected} disabled={genBusy}>
                  {genBusy ? "Saving…" : "Save selected"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCandidates([])}>
                  Discard
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {rows.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Known-good</TableHead>
                  <TableHead className="w-0 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="align-top">{c.input}</TableCell>
                    <TableCell className="align-top">{c.known_good}</TableCell>
                    <TableCell className="align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(c.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {start}–{end} of {total}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= maxPage}
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No cases yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Rubric ---------------------------------------------------------------

// Keyed on rubric id by the parent, so initial state is taken from the prop
// once it loads — no prop->state sync effect needed.
function Rubric({ base, rubric, onChange }) {
  const [ruleText, setRuleText] = useState(rubric?.rule_text ?? "");
  const [rules, setRules] = useState(rubric?.rules ?? []);
  const [graderMode, setGraderMode] = useState(rubric?.grader_mode ?? "suggest");
  const [criteria, setCriteria] = useState(rubric?.criteria ?? []);
  const [passThreshold, setPassThreshold] = useState(rubric?.pass_threshold ?? 70);
  const [critName, setCritName] = useState("");
  const [critDesc, setCritDesc] = useState("");
  const [type, setType] = useState("max_length");
  const [value, setValue] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const numericRule = ["max_length", "min_length", "count_equals", "rouge_l", "jaccard"];

  function addRule() {
    const rule = { type };
    if (numericRule.includes(type)) rule.value = Number(value);
    if (type === "must_contain" || type === "must_not_contain") rule.value = value;
    if (type === "count_equals") rule.token = token;
    setRules((prev) => [...prev, rule]);
    setValue("");
    setToken("");
  }

  function addCriterion() {
    if (!critName.trim()) return;
    setCriteria((prev) => [...prev, { name: critName.trim(), description: critDesc.trim() }]);
    setCritName("");
    setCritDesc("");
  }

  async function save() {
    setBusy(true);
    try {
      await jsonFetch(`${base}/rubric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_text: ruleText,
          rules,
          grader_mode: graderMode,
          criteria,
          pass_threshold: Number(passThreshold),
        }),
      });
      onChange();
    } catch (err) {
      toast.error(`Couldn't save rubric: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const needsValue = type !== "exact_match";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rubric</CardTitle>
        <CardDescription>
          Plain-English rule plus the machine checks the computer runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-2">
          <Label>Rule (plain English)</Label>
          <Textarea
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            placeholder="Asset must use the approved logo, brand colours, and fonts. Flag any off-brand colour or a logo below minimum size as FAIL."
          />
        </div>

        <div className="grid gap-3">
          <Label>Machine rules</Label>
          <div className="flex flex-wrap items-end gap-2">
            <NativeSelect
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {RULE_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {t}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {type === "count_equals" ? (
              <Input
                placeholder="token (e.g. violation)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-40"
              />
            ) : null}
            {needsValue ? (
              <Input
                placeholder="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-40"
              />
            ) : null}
            <Button type="button" variant="secondary" onClick={addRule}>
              Add rule
            </Button>
          </div>

          {rules.length ? (
            <ul className="grid gap-1">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <code>{JSON.stringify(r)}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRules((p) => p.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No machine rules yet — without them, cases follow the fuzzy-case
              grader below.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="grader-mode">Fuzzy-case grader</Label>
          <NativeSelect
            id="grader-mode"
            value={graderMode}
            onChange={(e) => setGraderMode(e.target.value)}
            className="w-full max-w-sm"
          >
            <NativeSelectOption value="suggest">
              AI suggests, human decides
            </NativeSelectOption>
            <NativeSelectOption value="judge">
              AI judges pass/fail (human can override)
            </NativeSelectOption>
          </NativeSelect>
          <p className="text-muted-foreground text-xs">
            Applies only to cases with no machine rule. Machine rules always
            decide on their own.
          </p>
        </div>

        {graderMode === "judge" ? (
          <div className="grid gap-3">
            <Label>Scoring criteria (judge mode)</Label>
            <p className="text-muted-foreground text-xs">
              With criteria, the AI scores each one 0–100 and an overall; pass if
              overall ≥ threshold. Leave empty for a plain pass/fail judge.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="criterion (e.g. Strategic)"
                value={critName}
                onChange={(e) => setCritName(e.target.value)}
                className="w-48"
              />
              <Input
                placeholder="what it means (optional)"
                value={critDesc}
                onChange={(e) => setCritDesc(e.target.value)}
                className="w-64"
              />
              <Button type="button" variant="secondary" onClick={addCriterion}>
                Add criterion
              </Button>
            </div>
            {criteria.length ? (
              <ul className="grid gap-1">
                {criteria.map((c, i) => (
                  <li key={i} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <span>
                      <strong>{c.name}</strong>
                      {c.description ? <span className="text-muted-foreground"> — {c.description}</span> : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCriteria((p) => p.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No criteria — judge returns a plain pass/fail.</p>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="pass-threshold" className="text-xs">Pass threshold</Label>
              <Input
                id="pass-threshold"
                type="number"
                min="0"
                max="100"
                value={passThreshold}
                onChange={(e) => setPassThreshold(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
        ) : null}

        <Button onClick={save} disabled={busy || !ruleText.trim()} className="justify-self-start">
          {busy ? "Saving…" : "Save rubric"}
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Run ------------------------------------------------------------------

function RunPanel({ base, cases, rubric, onRun }) {
  const [label, setLabel] = useState("");
  const [outputs, setOutputs] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const machine = isMachineCheckable(rubric?.rules ?? []);

  async function run(e) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      label,
      outputs: cases.map((c) => ({
        golden_case_id: c.id,
        actual_output: outputs[c.id] ?? "",
      })),
    };
    try {
      const body = await jsonFetch(`${base}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(body);
      onRun();
    } catch (err) {
      toast.error(`Grading failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!cases.length) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-sm">
          Add golden cases first, then run your feature against them here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run</CardTitle>
        <CardDescription>Paste the feature&apos;s actual output for each case, then grade.</CardDescription>
      </CardHeader>
      <CardContent>
        {!machine ? (
          <p className="text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2 text-sm">
            This rubric has no machine rules —{" "}
            {rubric?.grader_mode === "judge"
              ? "the AI will judge pass/fail for each case (you can override any verdict in Results)."
              : "the AI will suggest a possible failure for each case and a human confirms pass/fail in Results."}
          </p>
        ) : null}
        <form onSubmit={run} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Run label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="v1 — before fix"
            />
          </div>
          {cases.map((c) => (
            <div key={c.id} className="grid gap-2">
              <Label className="text-muted-foreground text-xs">{c.input}</Label>
              <Textarea
                value={outputs[c.id] ?? ""}
                onChange={(e) => setOutputs((p) => ({ ...p, [c.id]: e.target.value }))}
                placeholder="e.g. PASS — all brand elements within guideline"
              />
            </div>
          ))}
          <Button type="submit" disabled={busy} className="justify-self-start">
            {busy ? "Grading…" : "Grade run"}
          </Button>
        </form>

        {result?.summary ? (
          <div className="mt-6 grid gap-2">
            <p className="text-sm font-medium">
              {result.summary.pass} pass / {result.summary.fail} fail
              {result.summary.pending
                ? ` / ${result.summary.pending} needs review`
                : ""}{" "}
              of {result.summary.total}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verdict</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.grades.map((g) => (
                  <TableRow key={g.golden_case_id}>
                    <TableCell><Verdict value={g.verdict} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{g.decided_by}</TableCell>
                    <TableCell className="text-sm">{g.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Results --------------------------------------------------------------

function Results({ runs, onChange }) {
  const [runId, setRunId] = useState("");
  const [grades, setGrades] = useState([]);

  useEffect(() => {
    if (!runId) return;
    jsonFetch(`/api/runs/${runId}/grades`)
      .then((b) => setGrades(b.grades ?? []))
      .catch((e) => toast.error(`Couldn't load grades: ${e.message}`));
  }, [runId]);

  async function deleteRun() {
    if (!runId) return;
    try {
      await jsonFetch(`/api/runs/${runId}`, { method: "DELETE" });
      setRunId("");
      setGrades([]);
      onChange?.();
    } catch (e) {
      toast.error(`Couldn't delete run: ${e.message}`);
    }
  }

  async function override(id, verdict) {
    try {
      await jsonFetch(`/api/grades/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, note: "human override" }),
      });
      setGrades((prev) =>
        prev.map((g) => (g.id === id ? { ...g, verdict, decided_by: "human" } : g)),
      );
    } catch (e) {
      toast.error(`Couldn't override verdict: ${e.message}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>Per-case verdicts. A human can override the fuzzy ones.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2">
          <NativeSelect
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            className="w-full max-w-sm"
          >
            <NativeSelectOption value="">Pick a run…</NativeSelectOption>
            {runs.map((r) => (
              <NativeSelectOption key={r.id} value={r.id}>
                {r.label || r.id.slice(0, 8)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {runId ? (
            <Button variant="ghost" size="sm" onClick={deleteRun}>
              Delete run
            </Button>
          ) : null}
        </div>

        <ConfusionMatrix grades={grades} />

        {grades.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Input</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="max-w-[16rem] align-top text-xs">{g.golden_case?.input}</TableCell>
                  <TableCell className="align-top">
                    <Verdict value={g.verdict} />
                    {g.score != null ? (
                      <span className="text-muted-foreground ml-1 text-xs">{g.score}/100</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground align-top text-xs">{g.decided_by}</TableCell>
                  <TableCell className="align-top text-sm">{g.note ?? "—"}</TableCell>
                  <TableCell className="space-x-1 text-right align-top">
                    <Button size="sm" variant="ghost" onClick={() => override(g.id, "pass")}>
                      Pass
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => override(g.id, "fail")}>
                      Fail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Confusion matrix -----------------------------------------------------

// Machine verdict (auto_verdict, captured at grade time) vs the human verdict,
// over cases a human reviewed. The dangerous cell is machine PASS + human FAIL
// (a false pass — the grader would have shipped a bad output). Only counts
// cases where the machine actually produced a verdict AND a human decided.
function ConfusionMatrix({ grades }) {
  const reviewed = grades.filter(
    (g) =>
      g.decided_by === "human" &&
      (g.auto_verdict === "pass" || g.auto_verdict === "fail"),
  );
  if (!reviewed.length) return null;

  const count = (m, h) =>
    reviewed.filter((g) => g.auto_verdict === m && g.verdict === h).length;
  const truePass = count("pass", "pass");
  const falsePass = count("pass", "fail");
  const falseFail = count("fail", "pass");
  const trueFail = count("fail", "fail");
  const total = reviewed.length;
  const falsePassRate = ((falsePass / total) * 100).toFixed(0);

  // Classification metrics. Positive class = the grader flags a FAIL (catching a
  // bad output): TP=trueFail, FP=falseFail, FN=falsePass, TN=truePass.
  const tp = trueFail;
  const fp = falseFail;
  const fn = falsePass;
  const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : "—");
  const precision = pct(tp, tp + fp);
  const recall = pct(tp, tp + fn);
  const accuracy = pct(truePass + trueFail, total);
  const f1 =
    tp && 2 * tp + fp + fn ? ((2 * tp) / (2 * tp + fp + fn)).toFixed(2) : "—";

  const cell = (n, danger) => (
    <TableCell className={`text-center font-medium ${danger && n ? "text-destructive" : ""}`}>
      {n}
      {danger && n ? " ⚠" : ""}
    </TableCell>
  );

  return (
    <div className="grid gap-2 rounded-md border p-4">
      <p className="text-sm font-medium">
        Grader vs human ({total} reviewed) —{" "}
        <span className={falsePass ? "text-destructive" : ""}>
          {falsePass} false pass{falsePass === 1 ? "" : "es"} ({falsePassRate}%)
        </span>
        , {falseFail} false fail
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32" />
            <TableHead className="text-center">human PASS</TableHead>
            <TableHead className="text-center">human FAIL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-muted-foreground text-xs">machine PASS</TableCell>
            {cell(truePass, false)}
            {cell(falsePass, true)}
          </TableRow>
          <TableRow>
            <TableCell className="text-muted-foreground text-xs">machine FAIL</TableCell>
            {cell(falseFail, false)}
            {cell(trueFail, false)}
          </TableRow>
        </TableBody>
      </Table>
      <p className="text-sm">
        Accuracy {accuracy} · Precision {precision} · Recall {recall} · F1 {f1}
      </p>
      <p className="text-muted-foreground text-xs">
        Positive class = grader flags a FAIL (catching a bad output). Recall is
        how many truly-bad outputs it caught; a miss is a false pass. Counts only
        cases a human reviewed and the machine had scored, so this is agreement on
        reviewed cases — not a population-wide rate.
      </p>
    </div>
  );
}

// --- Compare --------------------------------------------------------------

function Compare({ base, runs }) {
  const [run1, setRun1] = useState("");
  const [run2, setRun2] = useState("");
  const [diff, setDiff] = useState(null);

  async function compare() {
    try {
      setDiff(await jsonFetch(`${base}/compare?run1=${run1}&run2=${run2}`));
    } catch (e) {
      toast.error(`Compare failed: ${e.message}`);
    }
  }

  const changeColor = {
    fixed: "secondary",
    broke: "destructive",
    same: "outline",
    changed: "outline",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare</CardTitle>
        <CardDescription>Line up two runs case-by-case: what got fixed, what broke.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <RunSelect label="Run 1" runs={runs} value={run1} onChange={setRun1} />
          <RunSelect label="Run 2" runs={runs} value={run2} onChange={setRun2} />
          <Button onClick={compare} disabled={!run1 || !run2 || run1 === run2}>
            Compare
          </Button>
        </div>

        {diff?.summary ? (
          <>
            <p className="text-sm font-medium">
              {diff.summary.fixed} fixed · {diff.summary.broke} broke · {diff.summary.same} unchanged
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Run 1</TableHead>
                  <TableHead>Run 2</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.cases.map((c) => (
                  <TableRow key={c.golden_case_id}>
                    <TableCell className="max-w-[16rem] align-top text-xs">{c.input}</TableCell>
                    <TableCell className="align-top"><Verdict value={c.run1} /></TableCell>
                    <TableCell className="align-top"><Verdict value={c.run2} /></TableCell>
                    <TableCell className="align-top">
                      <Badge variant={changeColor[c.change]}>{c.change}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Quick test -----------------------------------------------------------

// Grade arbitrary content against the rubric without a run or golden case. Each
// test is saved to a per-feature history (the quick_test table).
function QuickTest({ base, rubric }) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null); // { data, media_type, name }
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [runs, setRuns] = useState(5);
  const [stability, setStability] = useState(null);
  const [stabBusy, setStabBusy] = useState(false);

  const machine = isMachineCheckable(rubric?.rules ?? []);

  const loadHistory = useCallback(async () => {
    try {
      const b = await jsonFetch(`${base}/quick-test`);
      setHistory(b.quick_tests ?? []);
    } catch (e) {
      toast.error(`Couldn't load quick tests: ${e.message}`);
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setImage({ data: String(reader.result), media_type: file.type, name: file.name });
    reader.onerror = () => toast.error("Couldn't read that image.");
    reader.readAsDataURL(file);
  }

  async function test(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { content };
      if (image) payload.image = { data: image.data, media_type: image.media_type };
      await jsonFetch(`${base}/quick-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setContent("");
      setImage(null);
      await loadHistory();
    } catch (err) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(testId) {
    try {
      await jsonFetch(`${base}/quick-test?id=${testId}`, { method: "DELETE" });
      await loadHistory();
    } catch (err) {
      toast.error(`Couldn't delete: ${err.message}`);
    }
  }

  async function checkStability() {
    setStabBusy(true);
    setStability(null);
    try {
      const payload = { content, runs: Number(runs) };
      if (image) payload.image = { data: image.data, media_type: image.media_type };
      const body = await jsonFetch(`${base}/stability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStability(body);
    } catch (err) {
      toast.error(`Stability check failed: ${err.message}`);
    } finally {
      setStabBusy(false);
    }
  }

  if (!rubric) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-sm">
          Save a rubric first, then test any content against it here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick test</CardTitle>
        <CardDescription>
          Grade any content or image against this rubric — no golden case needed.
          Each test is saved to the history below.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!machine ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
            This rubric has no machine rules —{" "}
            {rubric.grader_mode === "judge"
              ? "the AI judges pass/fail."
              : "the AI suggests a possible failure for a human to confirm."}
          </p>
        ) : null}
        <form onSubmit={test} className="grid gap-3">
          <div className="grid gap-2">
            <Label>Content to test</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Our premium ecosystem powers your brand journey."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quick-test-image">Image to test (optional)</Label>
            <Input
              id="quick-test-image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onPickImage}
            />
            <p className="text-muted-foreground text-xs">
              {image
                ? `Attached: ${image.name}`
                : "Machine rules can't read images — an attached image is always reviewed by AI."}
            </p>
          </div>
          <Button
            type="submit"
            disabled={busy || (!content.trim() && !image)}
            className="justify-self-start"
          >
            {busy ? "Testing…" : "Test content"}
          </Button>
        </form>

        <div className="grid gap-2 border-t pt-4">
          <Label className="text-sm">Stability (consistency) check</Label>
          <p className="text-muted-foreground text-xs">
            Grade the same input several times to see how consistent the AI is —
            reliability, not accuracy. Only meaningful in judge mode (machine
            rules are deterministic).
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="2"
              max="10"
              value={runs}
              onChange={(e) => setRuns(e.target.value)}
              className="w-20"
            />
            <span className="text-muted-foreground text-xs">runs</span>
            <Button
              type="button"
              variant="secondary"
              onClick={checkStability}
              disabled={stabBusy || (!content.trim() && !image)}
            >
              {stabBusy ? "Checking…" : "Check stability"}
            </Button>
          </div>

          {stability ? (
            stability.status === "ok" ? (
              <div className="grid gap-1 rounded-md border p-4 text-sm">
                <p className="font-medium">
                  {stability.summary.stablePct}% stable over {stability.runs} runs —
                  modal verdict{" "}
                  <span className="font-mono">{stability.summary.modalVerdict}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  verdicts:{" "}
                  {Object.entries(stability.summary.counts)
                    .map(([v, n]) => `${v}×${n}`)
                    .join(" · ")}
                  {stability.summary.score
                    ? ` — score mean ${stability.summary.score.mean} ± ${stability.summary.score.sd} (${stability.summary.score.min}–${stability.summary.score.max})`
                    : ""}
                </p>
                {stability.summary.stablePct < 100 ? (
                  <p className="text-destructive text-xs">
                    ⚠ The grader disagreed with itself — this case is borderline or
                    the rubric is ambiguous.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
                {stability.message}
              </p>
            )
          ) : null}
        </div>

        {history.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tested</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-[14rem] align-top text-xs">{t.content}</TableCell>
                  <TableCell className="align-top">
                    <Verdict value={t.verdict} />
                    {t.score != null ? (
                      <span className="text-muted-foreground ml-1 text-xs">{t.score}/100</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground align-top text-xs">{t.decided_by}</TableCell>
                  <TableCell className="align-top text-sm">{t.note ?? "—"}</TableCell>
                  <TableCell className="align-top text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">No quick tests yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function RunSelect({ label, runs, value, onChange }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <NativeSelectOption value="">Pick…</NativeSelectOption>
        {runs.map((r) => (
          <NativeSelectOption key={r.id} value={r.id}>
            {r.label || r.id.slice(0, 8)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
