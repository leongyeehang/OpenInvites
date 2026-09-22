// A host's description, stored as a document rather than as HTML (see the ticket 17 notes). The
// application is the only thing that ever writes HTML from it, so nothing a host pastes can
// survive as markup: what is not in this model does not exist.

export const MARKS = ["bold", "italic"] as const;

export type Mark = (typeof MARKS)[number];

// A run of text, optionally emphasised and optionally a link.
export type Span = { text: string; marks?: Mark[]; href?: string };

export type Block = { type: "paragraph"; spans: Span[] } | { type: "bullets"; items: Span[][] };

export type RichText = { blocks: Block[] };

export const EMPTY_RICH_TEXT: RichText = { blocks: [] };

// Long enough for the warmest invitation, short enough that the column is not a filing cabinet.
export const MAX_DESCRIPTION = 10_000;

// The only schemes a guest can be sent to. Anything else is dropped, and the words stay.
const LINK_SCHEMES = ["http:", "https:", "mailto:"];

export type RichTextError = "descriptionTooLong";

export type ParsedRichText = { ok: true; doc: RichText } | { ok: false; error: RichTextError };

// Exported because the spec asks for the check on save and again on render: a row that
// reached the database another way is still not allowed to send a guest anywhere odd.
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return LINK_SCHEMES.includes(new URL(value.trim()).protocol) ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

function readSpan(value: unknown): Span | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== "string" || !raw.text) return undefined;

  const given: unknown[] = Array.isArray(raw.marks) ? raw.marks : [];
  const marks = MARKS.filter((mark) => given.includes(mark));
  const href = safeHref(raw.href);
  return { text: raw.text, ...(marks.length > 0 ? { marks } : {}), ...(href ? { href } : {}) };
}

function readSpans(value: unknown): Span[] {
  return Array.isArray(value) ? value.map(readSpan).filter((span): span is Span => span !== undefined) : [];
}

// A run of text with nothing in it but spaces is not worth a line on the invitation.
function saidSomething(spans: Span[]): boolean {
  return spans.some((span) => span.text.trim() !== "");
}

function readBlock(value: unknown): Block | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;

  if (raw.type === "paragraph") {
    const spans = readSpans(raw.spans);
    return saidSomething(spans) ? { type: "paragraph", spans } : undefined;
  }
  if (raw.type === "bullets") {
    const items = (Array.isArray(raw.items) ? raw.items : []).map(readSpans).filter(saidSomething);
    return items.length > 0 ? { type: "bullets", items } : undefined;
  }
  return undefined;
}

function lengthOf(doc: RichText): number {
  return doc.blocks.reduce(
    (total, block) =>
      total +
      (block.type === "paragraph" ? block.spans : block.items.flat()).reduce((sum, span) => sum + span.text.length, 0),
    0,
  );
}

// Reads what the editor posted, block by block. Anything unrecognised is left out rather than
// refused, so a hostile paste costs the host their formatting and nothing more.
export function parseRichText(posted: unknown): ParsedRichText {
  const blocks = (posted as { blocks?: unknown } | null)?.blocks;
  const doc: RichText = {
    blocks: (Array.isArray(blocks) ? blocks : []).map(readBlock).filter((block): block is Block => block !== undefined),
  };
  return lengthOf(doc) > MAX_DESCRIPTION ? { ok: false, error: "descriptionTooLong" } : { ok: true, doc };
}

// The description as plain words, for the calendar file and the preview card.
export function richTextToPlain(doc: RichText): string {
  const line = (spans: Span[]) =>
    spans.map((span) => (span.href && span.href !== span.text ? `${span.text} (${span.href})` : span.text)).join("");
  return doc.blocks
    .map((block) =>
      block.type === "paragraph" ? line(block.spans) : block.items.map((item) => `• ${line(item)}`).join("\n"),
    )
    .join("\n\n");
}
