import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDocMeta } from "@/lib/docs-nav";

// Server-only: reads the markdown source for a slug from the repo-root doc/
// folder. Imports node:fs, so only ever import this from Server Components.
// Doc pages are statically generated (generateStaticParams + force-static), so
// these reads run at build time — never per request.
export async function getDoc(slug) {
  const meta = getDocMeta(slug);
  if (!meta) return null;

  const filePath = path.join(process.cwd(), "doc", `${slug}.md`);
  const content = await readFile(filePath, "utf8");
  return { ...meta, content };
}

export { getDocMeta, listSlugs, groupedDocs, DOCS, DOC_GROUPS } from "@/lib/docs-nav";
