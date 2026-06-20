// Server-only Claude call behind the suggest-only assist in grading.js.
//
// This file statically imports the Anthropic SDK, so it must never be imported
// from a Client Component. grading.js loads it via dynamic import() inside an
// async function that only runs on the server (the runs API route), which keeps
// the SDK out of the client bundle.

import Anthropic from "@anthropic-ai/sdk";

// Lightweight, high-frequency assist (runs per golden case), so default to the
// fast/cheap Haiku tier. Override to "claude-sonnet-4-5" for sharper judgment.
const MODEL = process.env.ANTHROPIC_SUGGEST_MODEL || "claude-haiku-4-5";

// Optional per-feature knowledge/reference doc, prepended to the prompt so the
// grader judges against the full source material (e.g. brand guidelines), not
// just the one-line rubric. Returns "" when there's no knowledge.
function sourceBlock(knowledge) {
  const k = String(knowledge ?? "").trim();
  return k ? `SOURCE / REFERENCE:\n${k}\n\n` : "";
}

const SYSTEM = `You are a meticulous QA reviewer assisting a human grader of AI feature outputs.

You NEVER give a final pass/fail verdict — a human decides that. Your only job is to flag concrete, likely problems for that human to confirm.

Compare the ACTUAL output against the KNOWN-GOOD answer the team committed to in advance. Call out specific issues you can see: missing required detail, wrong facts or numbers, invented/unsupported claims, banned or off-brand terms, tone mismatch, or length/format problems. Ground every point in the two texts — do not speculate beyond them.

Respond in 1-3 short, plain-text sentences. If nothing clearly stands out, say so and remind the reviewer to still confirm the fuzzy dimensions a rule can't check. No preamble, no markdown, no verdict.`;

/**
 * Ask Claude to suggest possible failures for one output. Returns a plain-text
 * note (never a verdict). Throws on provider/network errors so the caller can
 * fall back to the heuristic.
 *
 * @param {string} actual
 * @param {string} knownGood
 * @returns {Promise<string>}
 */
export async function suggestViaClaude(actual, knownGood, knowledge) {
  // Reads ANTHROPIC_API_KEY from the environment.
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${sourceBlock(knowledge)}KNOWN-GOOD answer:\n${knownGood || "(none provided)"}\n\nACTUAL output:\n${actual || "(empty)"}\n\nFlag possible problems with the actual output for a human to review.`,
      },
    ],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

const JUDGE_SYSTEM = `You are an evaluation judge scoring one AI feature output.

Grade the ACTUAL output strictly against the RUBRIC, using the KNOWN-GOOD answer as the reference the team committed to in advance. Decide a single verdict — "pass" or "fail" — based only on what the rubric requires. When the rubric is silent, lean on whether the actual output is materially as good as the known-good.

You are an automated first-pass grader; a human may override your verdict, so be precise and honest rather than lenient. Give a confidence level and a one-sentence rationale grounded in the two texts.`;

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["pass", "fail"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    rationale: { type: "string" },
  },
  required: ["verdict", "confidence", "rationale"],
};

/**
 * LLM-as-judge: score one output pass/fail against the rubric. Returns a graded
 * result (the verdict IS set here). Throws on provider/parse errors so the
 * caller can fall back to suggest-only.
 *
 * @returns {Promise<{verdict: 'pass'|'fail', decided_by: 'llm_judge', note: string}>}
 */
export async function judgeViaClaude(actual, knownGood, ruleText, knowledge) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: JUDGE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${sourceBlock(knowledge)}RUBRIC:\n${ruleText || "(none provided)"}\n\nKNOWN-GOOD answer:\n${knownGood || "(none provided)"}\n\nACTUAL output:\n${actual || "(empty)"}\n\nScore the actual output pass or fail against the rubric.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = JSON.parse(text); // throws on malformed output → caller falls back
  const verdict = parsed.verdict === "pass" ? "pass" : "fail";
  const confidence = parsed.confidence ?? "low";
  const rationale = (parsed.rationale ?? "").trim();

  return {
    verdict,
    decided_by: "llm_judge",
    note: `[${confidence} confidence] ${rationale}`.trim(),
  };
}

// --- Multi-criteria judge --------------------------------------------------

const MULTI_JUDGE_SYSTEM = `You are an evaluation judge scoring one output against a set of named CRITERIA.

For each criterion, give an integer score from 0 to 100 and a one-sentence rationale grounded in the output (and the SOURCE / REFERENCE and KNOWN-GOOD when provided). Then give an overall_score (0-100) reflecting the output as a whole. Be precise and honest — a human may override your scores.`;

const MULTI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          criterion: { type: "string" },
          score: { type: "integer" },
          rationale: { type: "string" },
        },
        required: ["criterion", "score", "rationale"],
      },
    },
    overall_score: { type: "integer" },
    summary: { type: "string" },
  },
  required: ["scores", "overall_score", "summary"],
};

/**
 * Score one output on each named criterion (0-100) plus an overall, then
 * pass/fail against the threshold. Throws on provider/parse errors so the
 * caller can fall back.
 *
 * @returns {Promise<{verdict: 'pass'|'fail', score: number, scores: object, decided_by: 'llm_judge', note: string}>}
 */
export async function judgeMultiViaClaude(actual, knownGood, ruleText, knowledge, criteria, threshold) {
  const client = new Anthropic();
  const list = criteria
    .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: MULTI_JUDGE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: MULTI_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${sourceBlock(knowledge)}CRITERIA (score each 0-100):\n${list}\n\nRUBRIC:\n${ruleText || "(none provided)"}\n\nKNOWN-GOOD answer:\n${knownGood || "(none provided)"}\n\nACTUAL output:\n${actual || "(empty)"}\n\nScore each criterion 0-100 and give an overall_score (0-100).`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = JSON.parse(text); // throws on malformed output → caller falls back
  const scoresObj = {};
  for (const s of parsed.scores ?? []) scoresObj[s.criterion] = s.score;
  const overall = Number(parsed.overall_score ?? 0);
  const verdict = overall >= threshold ? "pass" : "fail";
  const breakdown = (parsed.scores ?? [])
    .map((s) => `${s.criterion} ${s.score}`)
    .join(", ");

  return {
    verdict,
    score: overall,
    scores: scoresObj,
    decided_by: "llm_judge",
    note: `[${overall}/100, threshold ${threshold}] ${parsed.summary ?? ""}${breakdown ? ` — ${breakdown}` : ""}`.trim(),
  };
}

// --- Synthetic golden-case generation --------------------------------------
// AI PROPOSES candidate cases; a human reviews/edits/approves before any are
// saved (the route returns them unsaved). The model must support structured
// output — same convention as the judges (Haiku default, ANTHROPIC_SUGGEST_MODEL).

const GENERATE_SYSTEM = `You generate evaluation test cases for an AI feature.

Each case is a realistic INPUT (the brief/prompt the feature would receive) plus the KNOWN-GOOD answer a careful human reviewer would commit to in advance. Produce DIVERSE cases that probe real failure risks and edge cases — not just easy wins — grounded in the SOURCE / REFERENCE and the rubric when provided. Do not produce duplicates or trivial variations of each other or of inputs already listed.`;

const GENERATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          input: { type: "string" },
          known_good: { type: "string" },
        },
        required: ["input", "known_good"],
      },
    },
  },
  required: ["cases"],
};

/**
 * Generate up to `count` candidate golden cases. Loops in small batches, telling
 * the model which inputs already exist so it doesn't repeat. Returns an array of
 * { input, known_good } — never saved here.
 */
export async function generateCasesViaClaude(count, knowledge, ruleText, rules, seeds) {
  const client = new Anthropic();
  const want = Math.min(200, Math.max(1, Math.round(count) || 10));
  const BATCH = 20;
  const seen = new Set();
  const out = [];
  let guard = 0;

  while (out.length < want && guard < 25) {
    guard++;
    const ask = Math.min(BATCH, want - out.length);
    const existing = out.slice(-30).map((c) => c.input);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: GENERATE_SYSTEM,
      output_config: { format: { type: "json_schema", schema: GENERATE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `${sourceBlock(knowledge)}RUBRIC:\n${ruleText || "(none provided)"}\n\nMACHINE RULES:\n${JSON.stringify(rules ?? [])}\n\n${seeds ? `SEED EXAMPLES:\n${seeds}\n\n` : ""}${existing.length ? `ALREADY GENERATED (do not repeat these inputs):\n${existing.join("\n")}\n\n` : ""}Generate ${ask} NEW, diverse test cases.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      break;
    }

    let added = 0;
    for (const c of Array.isArray(parsed.cases) ? parsed.cases : []) {
      const input = String(c.input ?? "").trim();
      const known_good = String(c.known_good ?? "").trim();
      if (!input || !known_good) continue;
      const key = input.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ input, known_good });
      added++;
      if (out.length >= want) break;
    }
    if (!added) break; // model stopped producing anything new
  }

  return out.slice(0, want);
}

// --- Vision path (images) --------------------------------------------------
// Machine rules can't see pixels, so an image is always judged by the model
// against the rubric's plain-English rule. The configured model MUST support
// vision — Haiku 4.5 (the default) does; override to a sharper model with
// ANTHROPIC_SUGGEST_MODEL (e.g. claude-opus-4-8) for nuanced brand judgment.

const IMAGE_SUGGEST_SYSTEM = `You are a meticulous brand/design QA reviewer assisting a human grader.

You NEVER give a final pass/fail verdict — a human decides that. Your only job is to flag concrete, visible problems in the IMAGE against the RUBRIC for that human to confirm.

Look at what is actually in the image: off-brand colours, banned or generic fonts, purple gradients, neon, pure black (#000000) or pure white (#FFFFFF), crowded layouts, missing or misused logos, and anything the rubric calls out. Ground every point in what you can see — do not invent details that aren't in the image.

Respond in 1-3 short, plain-text sentences. If nothing clearly stands out, say so and remind the reviewer to still confirm the subjective dimensions. No preamble, no markdown, no verdict.`;

const IMAGE_JUDGE_SYSTEM = `You are an evaluation judge scoring one IMAGE against a brand/design RUBRIC.

Grade strictly on what is visible in the image. Decide a single verdict — "pass" or "fail" — based only on what the rubric requires (off-brand colours, banned/generic fonts, purple gradients, neon, pure black/white, crowded layouts, logo misuse, etc.). Ground your judgment in what you can actually see; do not invent details.

You are an automated first-pass grader; a human may override your verdict, so be precise and honest. Give a confidence level and a one-sentence rationale tied to the image.`;

function imageBlock(imageBase64, mediaType) {
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: imageBase64 },
  };
}

/**
 * Vision suggest — SUGGEST ONLY, no verdict. Flags visible problems in an image.
 * @returns {Promise<{decided_by: 'llm_suggested', note: string}>}
 */
export async function suggestImageViaClaude(imageBase64, mediaType, ruleText, knowledge) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: IMAGE_SUGGEST_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          imageBlock(imageBase64, mediaType),
          {
            type: "text",
            text: `${sourceBlock(knowledge)}RUBRIC:\n${ruleText || "(none provided)"}\n\nFlag possible problems with this image for a human to review.`,
          },
        ],
      },
    ],
  });

  const note = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return { decided_by: "llm_suggested", note };
}

/**
 * Vision judge — SCORES pass/fail for an image against the rubric. A human can
 * still override. Throws on provider/parse errors so the caller can fall back.
 * @returns {Promise<{verdict: 'pass'|'fail', decided_by: 'llm_judge', note: string}>}
 */
export async function judgeImageViaClaude(imageBase64, mediaType, ruleText, knowledge) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: IMAGE_JUDGE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          imageBlock(imageBase64, mediaType),
          {
            type: "text",
            text: `${sourceBlock(knowledge)}RUBRIC:\n${ruleText || "(none provided)"}\n\nScore this image pass or fail against the rubric.`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const parsed = JSON.parse(text); // throws on malformed output → caller falls back
  const verdict = parsed.verdict === "pass" ? "pass" : "fail";
  const confidence = parsed.confidence ?? "low";
  const rationale = (parsed.rationale ?? "").trim();

  return {
    verdict,
    decided_by: "llm_judge",
    note: `[${confidence} confidence] ${rationale}`.trim(),
  };
}
