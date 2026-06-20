// Curated registry for the docs section. Pure data — no node imports — so it is
// safe to import from both Server Components and the client sidebar. Titles and
// grouping are curated (not derived from the H1s) so the nav reads cleanly and
// stays in a deliberate order. Each slug maps to doc/<slug>.md at the repo root.
export const DOCS = [
  { slug: "summary", title: "Executive summary", group: "Overview" },
  { slug: "getting-started", title: "Getting started", group: "Overview" },

  { slug: "hypothesis", title: "Move 2 · The hypothesis", group: "The five moves" },
  { slug: "who-checks-what", title: "Move 3 · Who checks what", group: "The five moves" },
  { slug: "domain-model", title: "Move 4 · The domain model", group: "The five moves" },
  { slug: "testing", title: "Move 5 · In front of people", group: "The five moves" },

  { slug: "user-1", title: "Maha · Jewellery image generator", group: "Evidence" },
  { slug: "user-2", title: "Ananth · Multi-channel social", group: "Evidence" },
  { slug: "user-3", title: "Siddharth · Brand rulebook classifier", group: "Evidence" },
  { slug: "user-4", title: "Manoj · SEO content generator", group: "Evidence" },
];

// Group order is the order each group first appears in DOCS.
export const DOC_GROUPS = [...new Set(DOCS.map((d) => d.group))];

export function groupedDocs() {
  return DOC_GROUPS.map((group) => ({
    group,
    docs: DOCS.filter((d) => d.group === group),
  }));
}

export function getDocMeta(slug) {
  return DOCS.find((d) => d.slug === slug);
}

export function listSlugs() {
  return DOCS.map((d) => d.slug);
}
