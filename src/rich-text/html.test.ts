import { describe, expect, it } from "vitest";
import { richTextToHtml } from "./html";

describe("richTextToHtml", () => {
  it("writes the marks a host used", () => {
    expect(
      richTextToHtml({
        blocks: [
          { type: "paragraph", spans: [{ text: "Bring " }, { text: "nothing", marks: ["bold", "italic"] }] },
          { type: "bullets", items: [[{ text: "The map", href: "https://example.test/map" }]] },
        ],
      }),
    ).toBe(
      '<p>Bring <em><strong>nothing</strong></em></p><ul><li><a href="https://example.test/map">The map</a></li></ul>',
    );
  });

  it("escapes every character that could become markup", () => {
    const written = richTextToHtml({
      blocks: [{ type: "paragraph", spans: [{ text: `<script>alert("x" & 'y')</script>` }] }],
    });
    expect(written).toBe("<p>&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;</p>");
    expect(written).not.toContain("<script>");
  });
});
