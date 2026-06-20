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
  const [cases, setCases] = useState([]);
  const [rubric, setRubric] = useState(null);
  const [runs, setRuns] = useState([]);

  const base = `/api/features/${featureId}`;

  const loadAll = useCallback(async () => {
    try {
      const [c, r, ru] = await Promise.all([
        jsonFetch(`${base}/golden-cases`),
        jsonFetch(`${base}/rubric`),
        jsonFetch(`${base}/runs`),
      ]);
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
    <Tabs defaultValue="golden">
      <TabsList className="mb-4 flex-wrap">
        <TabsTrigger value="golden">Golden Set</TabsTrigger>
        <TabsTrigger value="rubric">Rubric</TabsTrigger>
        <TabsTrigger value="run">Run</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="compare">Compare</TabsTrigger>
      </TabsList>

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
    </Tabs>
  );
}

// --- Golden Set -----------------------------------------------------------

function GoldenSet({ base, cases, onChange }) {
  const [input, setInput] = useState("");
  const [knownGood, setKnownGood] = useState("");
  const [busy, setBusy] = useState(false);

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
      onChange();
    } catch (err) {
      toast.error(`Couldn't add case: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(caseId) {
    try {
      await jsonFetch(`${base}/golden-cases/${caseId}`, { method: "DELETE" });
      onChange();
    } catch (err) {
      toast.error(`Couldn't delete case: ${err.message}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Golden Set</CardTitle>
        <CardDescription>
          The answer key — write the known-good output <em>before</em> you run.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
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

        {cases.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Input</TableHead>
                <TableHead>Known-good</TableHead>
                <TableHead className="w-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
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
  const [type, setType] = useState("max_length");
  const [value, setValue] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  function addRule() {
    const rule = { type };
    if (type === "max_length" || type === "min_length" || type === "count_equals") {
      rule.value = Number(value);
    }
    if (type === "must_contain" || type === "must_not_contain") rule.value = value;
    if (type === "count_equals") rule.token = token;
    setRules((prev) => [...prev, rule]);
    setValue("");
    setToken("");
  }

  async function save() {
    setBusy(true);
    try {
      await jsonFetch(`${base}/rubric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: ruleText, rules, grader_mode: graderMode }),
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
                  <TableCell className="align-top"><Verdict value={g.verdict} /></TableCell>
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
