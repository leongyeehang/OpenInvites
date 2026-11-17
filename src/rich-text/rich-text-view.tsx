import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { safeHref, type RichText, type Span } from "./rich-text";

// The description on the invitation. React escapes every string it renders, so a document can
// only ever become the elements named here, whatever a host once pasted into the editor.
function spanOf(run: Span, key: number, linked: boolean): ReactNode {
  let node: ReactNode = run.text;
  if (run.marks?.includes("bold")) node = <strong>{node}</strong>;
  if (run.marks?.includes("italic")) node = <em>{node}</em>;
  // Checked again here, not only when it was saved.
  const href = safeHref(run.href);
  // Unlinked, a link's words keep its underline and go nowhere: the editor draws a Note under the
  // button that opens its sheet (M8 ticket 29), where a link of its own could not be pressed.
  if (href && !linked) node = <span className="underline decoration-theme-accent underline-offset-4">{node}</span>;
  else if (href) {
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

export function RichTextView({ doc, className, linked = true }: { doc: RichText; className?: string; linked?: boolean }) {
  const span = (run: Span, key: number) => spanOf(run, key, linked);
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
