// The grading engine — Move 3's boundary, in code.
//
// A simple rule decides wherever it can (the computer's side). The AI only
// SUGGESTS (the suggest-only assist); a human confirms the fuzzy ones. The
// final pass/fail is never the AI's call.
//
// Rule shapes (stored on rubric.rules as JSON):
//   { "type": "max_length",       "value": 60 }
//   { "type": "min_length",       "value": 10 }
//   { "type": "must_not_contain", "value": "IGI-Graded" }
//   { "type": "must_contain",     "value": "Hallmark" }
//   { "type": "exact_match" }                       // compares against known_good
//   { "type": "count_equals",     "token": "stone", "value": 20 }

/**
 * Grade one actual output against its known-good answer using the rubric rules.
 * Returns the FIRST rule that fails, or a pass if every rule holds.
 *
 * @param {string} actual     The feature's actual output for this case.
 * @param {string} knownGood  The answer key written in advance.
 * @param {Array}  rules      Machine-checkable rules from the rubric.
 * @returns {{verdict: 'pass'|'fail', decided_by: 'rule', note?: string}}
 */
export function gradeByRule(actual, knownGood, rules = []) {
  const text = String(actual ?? "");

  for (const rule of rules) {
    switch (rule.type) {
      case "max_length":
        if (text.length > rule.value) {
          return fail(`Over ${rule.value} chars (${text.length})`);
        }
        break;

      case "min_length":
        if (text.length < rule.value) {
          return fail(`Under ${rule.value} chars (${text.length})`);
        }
        break;

      case "must_not_contain":
        if (text.toLowerCase().includes(String(rule.value).toLowerCase())) {
          return fail(`Contains banned term "${rule.value}"`);
        }
        break;

      case "must_contain":
        if (!text.toLowerCase().includes(String(rule.value).toLowerCase())) {
          return fail(`Missing required term "${rule.value}"`);
        }
        break;

      case "exact_match":
        if (text.trim() !== String(knownGood ?? "").trim()) {
          return fail("Does not match known-good");
        }
        break;

      case "count_equals": {
        const n = countToken(text, rule.token);
        if (n !== rule.value) {
          return fail(`Count ${n}, expected ${rule.value} of "${rule.token}"`);
        }
        break;
      }

      default:
        // Unknown rule type is ignored rather than silently passing/failing.
        break;
    }
  }

  return { verdict: "pass", decided_by: "rule" };
}

/**
 * Whether the rubric can decide this case on its own (computer's side) or it
 * needs a person. If there are no machine rules, it falls to a human.
 */
export function isMachineCheckable(rules = []) {
  return Array.isArray(rules) && rules.length > 0;
}

const RULE_TYPES = new Set([
  "max_length",
  "min_length",
  "must_contain",
  "must_not_contain",
  "exact_match",
  "count_equals",
]);

/**
 * Validate the shape of stored rubric rules so bad rules are rejected on save
 * rather than silently ignored at grading time. Returns the first problem.
 *
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateRules(rules = []) {
  if (!Array.isArray(rules)) return { ok: false, error: "rules must be an array" };

  for (const [i, rule] of rules.entries()) {
    const where = `rule ${i + 1}`;
    if (!rule || typeof rule !== "object") {
      return { ok: false, error: `${where}: must be an object` };
    }
    if (!RULE_TYPES.has(rule.type)) {
      return { ok: false, error: `${where}: unknown type "${rule.type}"` };
    }
    if (rule.type === "max_length" || rule.type === "min_length") {
      if (typeof rule.value !== "number" || Number.isNaN(rule.value)) {
        return { ok: false, error: `${where}: ${rule.type} needs a numeric value` };
      }
    }
    if (rule.type === "must_contain" || rule.type === "must_not_contain") {
      if (typeof rule.value !== "string" || !rule.value.length) {
        return { ok: false, error: `${where}: ${rule.type} needs a non-empty value` };
      }
    }
    if (rule.type === "count_equals") {
      if (typeof rule.token !== "string" || !rule.token.length) {
        return { ok: false, error: `${where}: count_equals needs a token` };
      }
      if (typeof rule.value !== "number" || Number.isNaN(rule.value)) {
        return { ok: false, error: `${where}: count_equals needs a numeric value` };
      }
    }
  }
  return { ok: true };
}

/**
 * AI assist — SUGGEST ONLY. Never sets the final verdict.
 *
 * Returns a hint for a human to review. Uses Claude when ANTHROPIC_API_KEY is
 * configured, and falls back to a deterministic heuristic so the whole app
 * still runs with zero API keys. The shape is intentionally NOT {verdict}:
 * this function cannot pass or fail.
 *
 * @returns {Promise<{decided_by: 'llm_suggested', note: string}>}
 */
export async function suggestPossibleFailure(actual, knownGood, knowledge) {
  const text = String(actual ?? "");
  const good = String(knownGood ?? "");

  // Prefer a real model when configured. The Claude call lives in a separate
  // server-only module loaded lazily here, so the SDK never reaches the client
  // bundle (grading.js is also imported by a Client Component). Any provider or
  // network error falls through to the heuristic below.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { suggestViaClaude } = await import("./grading-claude.js");
      const note = await suggestViaClaude(text, good, knowledge);
      if (note) return { decided_by: "llm_suggested", note };
    } catch (err) {
      console.error("Claude suggestion failed; using heuristic:", err?.message);
    }
  }

  return heuristicSuggest(text, good);
}

/**
 * LLM-as-judge — SCORES pass/fail against the rubric. Unlike the suggest-only
 * path, this sets a verdict (decided_by 'llm_judge'); a human can still override.
 *
 * Falls back to the suggest-only path when no provider is configured or the
 * model call/parse fails, so a fuzzy case is never given a fabricated verdict.
 *
 * @returns {Promise<{verdict?: 'pass'|'fail', decided_by: string, note: string}>}
 */
export async function judgeByLLM(actual, knownGood, ruleText, knowledge) {
  const text = String(actual ?? "");
  const good = String(knownGood ?? "");

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { judgeViaClaude } = await import("./grading-claude.js");
      return await judgeViaClaude(text, good, ruleText, knowledge);
    } catch (err) {
      console.error("Claude judge failed; falling back to suggest:", err?.message);
    }
  }

  // No key (or error) — degrade to a suggest-only hint with no verdict.
  return heuristicSuggest(text, good);
}

/**
 * Vision suggest — flag possible problems in an image (no verdict). Machine
 * rules can't see pixels, so an image always goes to the model. Falls back to a
 * human-review note when no provider is configured (a heuristic can't see it).
 *
 * @returns {Promise<{decided_by: string, note: string}>}
 */
export async function suggestImageFailure(imageBase64, mediaType, ruleText, knowledge) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { suggestImageViaClaude } = await import("./grading-claude.js");
      return await suggestImageViaClaude(imageBase64, mediaType, ruleText, knowledge);
    } catch (err) {
      console.error("Claude image suggestion failed:", err?.message);
    }
  }
  return {
    decided_by: "llm_suggested",
    note: "Image grading needs an AI provider; a human should review this image.",
  };
}

/**
 * Vision judge — score an image pass/fail against the rubric (human-overridable).
 * Falls back to the suggest-only path when no provider is configured or the
 * model call/parse fails, so an image is never given a fabricated verdict.
 *
 * @returns {Promise<{verdict?: 'pass'|'fail', decided_by: string, note: string}>}
 */
export async function judgeImageByLLM(imageBase64, mediaType, ruleText, knowledge) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { judgeImageViaClaude } = await import("./grading-claude.js");
      return await judgeImageViaClaude(imageBase64, mediaType, ruleText, knowledge);
    } catch (err) {
      console.error("Claude image judge failed; falling back to suggest:", err?.message);
    }
  }
  return suggestImageFailure(imageBase64, mediaType, ruleText, knowledge);
}

// Deterministic suggest-only hint (no key required, no verdict).
function heuristicSuggest(text, good) {
  const hints = [];
  if (good && text && lengthRatio(text, good) > 1.5) {
    hints.push("Output is noticeably longer than the known-good — check for padding or repetition.");
  }
  if (good && text && lengthRatio(text, good) < 0.5) {
    hints.push("Output is much shorter than the known-good — it may be missing required detail.");
  }
  if (/!{2,}|\b(amazing|incredible|best ever)\b/i.test(text)) {
    hints.push("Tone may be too casual/hypey for a premium brand — needs a human check.");
  }

  return {
    decided_by: "llm_suggested",
    note: hints.length
      ? hints.join(" ")
      : "No obvious issue spotted — a human should still confirm the fuzzy dimensions.",
  };
}

// --- helpers ---------------------------------------------------------------

function fail(note) {
  return { verdict: "fail", decided_by: "rule", note };
}

function countToken(text, token) {
  if (!token) return 0;
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(escaped, "gi")) || []).length;
}

function lengthRatio(a, b) {
  const lb = (b ?? "").length || 1;
  return (a ?? "").length / lb;
}
