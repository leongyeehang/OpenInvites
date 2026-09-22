import { describe, expect, it } from "vitest";
import { parseRichText, richTextToPlain, type RichText } from "./rich-text";

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

  it("leaves out an empty paragraph and an empty bullet", () => {
    const gappy = doc([
      { type: "paragraph", spans: [{ text: "  " }] },
      { type: "bullets", items: [[{ text: "" }], [{ text: "Kept" }]] },
    ]);
    expect(parseRichText(gappy)).toEqual({ ok: true, doc: doc([{ type: "bullets", items: [[{ text: "Kept" }]] }]) });
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
