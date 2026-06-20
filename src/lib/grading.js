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

/**
 * AI assist — SUGGEST ONLY. Never sets the final verdict.
 *
 * Returns a hint for a human to review. When no provider is configured it
 * returns a deterministic heuristic so the whole app runs with zero API keys.
 * The shape is intentionally NOT {verdict}: this function cannot pass or fail.
 *
 * @returns {Promise<{decided_by: 'llm_suggested', note: string}>}
 */
export async function suggestPossibleFailure(actual, knownGood) {
  const text = actual ?? "";
  const good = knownGood ?? "";

  // Heuristic fallback (no key required). A real provider can replace this.
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
