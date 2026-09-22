import { safeHref, type RichText, type Span } from "./rich-text";

// The document as an HTML string, for seeding the host's editor. This is the one place the
// application writes markup from a document, so it escapes everything it did not write itself.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function spanHtml(span: Span): string {
  let html = escapeHtml(span.text);
  if (span.marks?.includes("bold")) html = `<strong>${html}</strong>`;
  if (span.marks?.includes("italic")) html = `<em>${html}</em>`;
  const href = safeHref(span.href);
  if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
  return html;
}

export function richTextToHtml(doc: RichText): string {
  return doc.blocks
    .map((block) =>
      block.type === "paragraph"
        ? `<p>${block.spans.map(spanHtml).join("")}</p>`
        : `<ul>${block.items.map((item) => `<li>${item.map(spanHtml).join("")}</li>`).join("")}</ul>`,
    )
    .join("");
}
