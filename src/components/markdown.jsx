import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Rewrites in-repo `./<slug>.md` cross-links to `/docs/<slug>` routes, sends
// external links out in a new tab, and passes app-internal links through
// next/link. Anything else renders as a plain anchor.
const MD_LINK = /^\.?\/?([a-z0-9-]+)\.md(#.*)?$/i;

function MarkdownLink({ href = "", children, ...props }) {
  const docMatch = href.match(MD_LINK);
  if (docMatch) {
    const [, slug, hash = ""] = docMatch;
    return <Link href={`/docs/${slug}${hash}`}>{children}</Link>;
  }

  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }

  // App-internal ("/dashboard", "#section", relative) → client navigation.
  return <Link href={href || "#"}>{children}</Link>;
}

// Plain <img> (not next/image) so the embedded mermaid.ink diagrams render
// without remote-image config or build-time fetches.
function MarkdownImage({ src, alt }) {
  return (
    // Remote mermaid.ink diagrams — a plain <img> avoids next/image remote
    // config and build-time fetches for these third-party URLs.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      className="rounded-md border bg-white"
    />
  );
}

export function Markdown({ content }) {
  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium prose-a:text-redpen prose-a:no-underline hover:prose-a:underline prose-code:font-mono prose-pre:font-mono prose-pre:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: MarkdownLink, img: MarkdownImage }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
