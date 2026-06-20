import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { getDoc, getDocMeta, listSlugs } from "@/lib/docs";

// Prerender every doc at build time; read the markdown from disk during build,
// never per request.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return listSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const meta = getDocMeta(slug);
  if (!meta) return {};
  return { title: `${meta.title} · Docs · Eval Copilot` };
}

export default async function DocPage({ params }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  return (
    <article>
      <Markdown content={doc.content} />
    </article>
  );
}
