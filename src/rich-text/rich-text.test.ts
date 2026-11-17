import { describe, expect, it } from "vitest";
import { clipRichText, MAX_HREF, parseRichText, richTextToPlain, safeHref, type RichText } from "./rich-text";

const doc = (blocks: RichText["blocks"]): RichText => ({ blocks });

describe("parseRichText", () => {
  it("keeps paragraphs, bullet lists, and the marks a host may use", () => {
    const written = {
      blocks: [
        { type: "paragraph", spans: [{ text: "Bring " }, { text: "nothing", marks: ["bold"] }, { text: "." }] },
        { type: "bullets", items: [[{ text: "Dress code: sparkly", marks: ["italic"] }], [{ text: "No nuts" }]] },
      ],
    };
    expect(parseRichText(written)).toEqual({ ok: true, doc: written });
  });

  it("keeps a link a guest can safely follow, and drops one they cannot", () => {
    const linked = (href: string) => ({ blocks: [{ type: "paragraph", spans: [{ text: "Map", href }] }] });
    for (const href of ["https://example.test/map", "http://example.test", "mailto:ada@example.test"]) {
      expect(parseRichText(linked(href))).toEqual({ ok: true, doc: linked(href) });
    }
    // The text stays; only the link goes.
    for (const href of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x", " javascript:alert(1)"]) {
      expect(parseRichText(linked(href))).toEqual({
        ok: true,
        doc: doc([{ type: "paragraph", spans: [{ text: "Map" }] }]),
      });
    }
  });

  // The part review's finding 8: an address is held to a Links section's (SECTION_LIMITS.url), so
  // words cannot carry megabytes of addresses; the words stay, as for any link that is dropped.
  it("drops a link whose address is longer than 2,000 characters, and keeps its words", () => {
    const linked = (href: string) => ({ blocks: [{ type: "paragraph", spans: [{ text: "Map", href }] }] });
    const longest = `https://example.test/${"a".repeat(MAX_HREF - "https://example.test/".length)}`;
    expect(parseRichText(linked(longest))).toEqual({ ok: true, doc: linked(longest) });
    expect(parseRichText(linked(`${longest}a`))).toEqual({ ok: true, doc: doc([{ type: "paragraph", spans: [{ text: "Map" }] }]) });
    expect(safeHref(`${longest}a`)).toBeUndefined();
    expect(MAX_HREF).toBe(2000);
  });

  it("drops anything it does not recognise rather than trusting it", () => {
    const hostile = {
      blocks: [
        { type: "script", spans: [{ text: "alert(1)" }] },
        { type: "paragraph", spans: [{ text: "Kept", marks: ["bold", "blink"] }, { text: 42 }, "nonsense"] },
        "not a block",
      ],
    };
    expect(parseRichText(hostile)).toEqual({
      ok: true,
      doc: doc([{ type: "paragraph", spans: [{ text: "Kept", marks: ["bold"] }] }]),
    });
  });

  it("reads anything that is not a document at all as an empty one", () => {
    expect(parseRichText(null)).toEqual({ ok: true, doc: doc([]) });
    expect(parseRichText("<p>hello</p>")).toEqual({ ok: true, doc: doc([]) });
  });

  it("refuses a description longer than an invitation should carry", () => {
    const wordy = doc([{ type: "paragraph", spans: [{ text: "x".repeat(10_001) }] }]);
    expect(parseRichText(wordy)).toEqual({ ok: false, error: "descriptionTooLong" });
  });

  it("holds a shorter document to the limit it is given, and to the description's without one", () => {
    const of = (length: number) => doc([{ type: "paragraph", spans: [{ text: "x".repeat(length) }] }]);
    expect(parseRichText(of(2_001), 2_000)).toEqual({ ok: false, error: "descriptionTooLong" });
    expect(parseRichText(of(2_000), 2_000)).toEqual({ ok: true, doc: of(2_000) });
    expect(parseRichText(of(10_000))).toEqual({ ok: true, doc: of(10_000) });
    expect(parseRichText(of(10_001))).toEqual({ ok: false, error: "descriptionTooLong" });
  });

  it("leaves out an empty paragraph and an empty bullet", () => {
    const gappy = doc([
      { type: "paragraph", spans: [{ text: "  " }] },
      { type: "bullets", items: [[{ text: "" }], [{ text: "Kept" }]] },
    ]);
    expect(parseRichText(gappy)).toEqual({ ok: true, doc: doc([{ type: "bullets", items: [[{ text: "Kept" }]] }]) });
  });
});

describe("clipRichText", () => {
  const href = "https://example.test/map";

  it("keeps the blocks in order up to the limit and cuts the span that crosses it, marks and link kept", () => {
    const long = doc([
      { type: "paragraph", spans: [{ text: "a".repeat(1_000) }, { text: "b".repeat(500), marks: ["bold"] }] },
      { type: "bullets", items: [[{ text: "c".repeat(400) }], [{ text: "d".repeat(300), marks: ["italic"], href }, { text: "e" }]] },
      { type: "paragraph", spans: [{ text: "never reached" }] },
    ]);
    expect(clipRichText(long, 2_000)).toEqual(
      doc([
        { type: "paragraph", spans: [{ text: "a".repeat(1_000) }, { text: "b".repeat(500), marks: ["bold"] }] },
        { type: "bullets", items: [[{ text: "c".repeat(400) }], [{ text: "d".repeat(100), marks: ["italic"], href }]] },
      ]),
    );
  });

  it("leaves a document within the limit as it was", () => {
    const short = doc([{ type: "paragraph", spans: [{ text: "Bring ", marks: ["bold"] }, { text: "nothing", href }] }]);
    expect(clipRichText(short, 2_000)).toEqual(short);
  });

  it("never cuts a character in half", () => {
    // An emoji is two UTF-16 units, as the length is counted: one that does not fit whole goes.
    const party = doc([{ type: "paragraph", spans: [{ text: "x🎉" }] }]);
    expect(clipRichText(party, 2)).toEqual(doc([{ type: "paragraph", spans: [{ text: "x" }] }]));
  });
});

describe("richTextToPlain", () => {
  it("writes the description as the calendar file and the preview card need it", () => {
    const written = doc([
      { type: "paragraph", spans: [{ text: "Bring " }, { text: "nothing", marks: ["bold"] }, { text: "." }] },
      { type: "bullets", items: [[{ text: "Sparkly" }], [{ text: "No nuts" }]] },
      { type: "paragraph", spans: [{ text: "The map", href: "https://example.test/map" }] },
    ]);
    expect(richTextToPlain(written)).toBe("Bring nothing.\n\n• Sparkly\n• No nuts\n\nThe map (https://example.test/map)");
  });

  it("says nothing about an empty description", () => {
    expect(richTextToPlain(doc([]))).toBe("");
  });
});
