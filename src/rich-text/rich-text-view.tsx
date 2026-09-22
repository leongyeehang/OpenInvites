import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { safeHref, type RichText, type Span } from "./rich-text";

// The description on the invitation. React escapes every string it renders, so a document can
// only ever become the elements named here, whatever a host once pasted into the editor.
function span(run: Span, key: number): ReactNode {
  let node: ReactNode = run.text;
  if (run.marks?.includes("bold")) node = <strong>{node}</strong>;
  if (run.marks?.includes("italic")) node = <em>{node}</em>;
  // Checked again here, not only when it was saved.
  const href = safeHref(run.href);
  if (href) {
    node = (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline decoration-theme-accent underline-offset-4"
      >
        {node}
      </a>
    );
  }
  return <span key={key}>{node}</span>;
}

export function RichTextView({ doc, className }: { doc: RichText; className?: string }) {
  return (
    <div className={cn("whitespace-pre-line", className)}>
      {doc.blocks.map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index} className="mt-3 first:mt-0">
            {block.spans.map(span)}
          </p>
        ) : (
          <ul key={index} className="mt-3 list-disc pl-5 first:mt-0">
            {block.items.map((item, at) => (
              <li key={at}>{item.map(span)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
