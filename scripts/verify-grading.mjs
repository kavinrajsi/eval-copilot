// Verify the verifier (Move 5, section 6).
//
// Before the grader is trusted on an unseen case, it must reproduce verdicts we
// already know are true — flag the known-bad, pass the known-good. This runs the
// real grading engine against the Move 1 cases. If any verdict is wrong, exit 1.
//
//   node scripts/verify-grading.mjs

import { gradeByRule } from "../src/lib/grading.js";

const cases = [
  {
    name: "Maha #1 — correct solitaire",
    rules: [{ type: "must_contain", value: "yellow gold" }, { type: "must_not_contain", value: "distorted" }],
    actual: "Single centre stone, yellow gold band, clean marble background.",
    knownGood: "One stone, yellow gold band, clean marble background.",
    expect: "pass",
  },
  {
    name: "Maha #2 — 17 stones, not 20",
    rules: [{ type: "count_equals", token: "stone", value: 20 }],
    actual: Array(17).fill("stone").join(", "),
    knownGood: Array(20).fill("stone").join(", "),
    expect: "fail",
  },
  {
    name: "Manoj #1 — 62-char meta title (over 60)",
    rules: [{ type: "max_length", value: 60 }],
    actual: "Start Your Gold Savings Scheme Today and Save More Every Month", // 62 chars
    knownGood: "Gold Savings Scheme – Save More Monthly",
    expect: "fail",
  },
  {
    name: "Manoj #1b — 40-char meta title (known-good)",
    rules: [{ type: "max_length", value: 60 }],
    actual: "Gold Savings Scheme – Save More Monthly", // 39 chars
    knownGood: "Gold Savings Scheme – Save More Monthly",
    expect: "pass",
  },
  {
    name: 'Manoj #5 — invented "IGI-Graded" claim',
    rules: [{ type: "must_not_contain", value: "IGI-Graded" }],
    actual: "Shop BIS Hallmark & IGI-Graded Gold Jewellery",
    knownGood: "Shop BIS Hallmark Certified Gold Jewellery",
    expect: "fail",
  },
];

let failures = 0;
for (const c of cases) {
  const got = gradeByRule(c.actual, c.knownGood, c.rules);
  const okMark = got.verdict === c.expect ? "✅" : "❌";
  if (got.verdict !== c.expect) failures++;
  console.log(
    `${okMark}  ${c.name.padEnd(42)} expected ${c.expect.padEnd(4)} got ${got.verdict.padEnd(4)} ${got.note ? "— " + got.note : ""}`,
  );
}

console.log("");
if (failures) {
  console.error(`Verify-the-verifier FAILED: ${failures} mismatch(es). The grader cannot be trusted.`);
  process.exit(1);
}
console.log("Verify-the-verifier PASSED: the grader reproduces every known verdict.");
