import { type Block, type Mark, type RichText, type Span } from "./rich-text";

// Reads what the host has actually typed into their editor. The browser's own editing commands
// leave all sorts behind, and a paste can bring anything at all, so this keeps only what the
// document model has words for; everything else contributes its text, or nothing.

// Elements whose text is never something a host meant to write.
const NEVER = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template"]);

const tagOf = (node: Node) => (node instanceof HTMLElement ? node.tagName.toLowerCase() : "");

function spansIn(node: Node, marks: Mark[], href: string | undefined, into: Span[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text) into.push({ text, ...(marks.length > 0 ? { marks: [...marks] } : {}), ...(href ? { href } : {}) });
    return;
  }
  const tag = tagOf(node);
  if (!tag || NEVER.has(tag)) return;
  if (tag === "br") {
    into.push({ text: "\n" });
    return;
  }

  const inside: Mark[] = [...marks];
  if ((tag === "b" || tag === "strong") && !inside.includes("bold")) inside.push("bold");
  if ((tag === "i" || tag === "em") && !inside.includes("italic")) inside.push("italic");
  const linked = tag === "a" ? ((node as HTMLElement).getAttribute("href") ?? undefined) : href;

  for (const child of node.childNodes) spansIn(child, inside, linked, into);
}

function spansOf(node: Node): Span[] {
  const spans: Span[] = [];
  for (const child of node.childNodes) spansIn(child, [], undefined, spans);
  return spans;
}

export function readRichText(root: HTMLElement): RichText {
  const blocks: Block[] = [];
  let loose: Span[] = [];
  const endParagraph = () => {
    if (loose.length > 0) blocks.push({ type: "paragraph", spans: loose });
    loose = [];
  };

  // Browsers nest what they like: making a list out of a paragraph leaves the list inside it.
  // So this walks the tree rather than the top level, and lets a block end a paragraph wherever
  // it turns up.
  const walk = (node: Node) => {
    const tag = tagOf(node);
    if (NEVER.has(tag)) return;

    // A numbered list is not on the menu, so it arrives as bullets.
    if (tag === "ul" || tag === "ol") {
      endParagraph();
      const items = [...node.childNodes].filter((child) => tagOf(child) === "li").map(spansOf);
      if (items.length > 0) blocks.push({ type: "bullets", items });
      return;
    }
    if (tag === "p" || tag === "div" || tag === "li") {
      endParagraph();
      for (const child of node.childNodes) walk(child);
      endParagraph();
      return;
    }
    spansIn(node, [], undefined, loose);
  };

  for (const child of root.childNodes) walk(child);
  endParagraph();
  return { blocks };
}
