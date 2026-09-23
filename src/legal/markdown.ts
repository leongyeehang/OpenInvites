import MarkdownIt from "markdown-it";

// The operator's legal pages are prose, not markup: raw HTML in them is shown as the text it is,
// and markdown-it makes no link out of a javascript:, vbscript:, file: or data: address.
const markdown = new MarkdownIt({ html: false });

export function renderMarkdown(text: string): string {
  return markdown.render(text);
}
