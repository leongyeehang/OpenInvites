import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("turns the operator's prose into headings, paragraphs, lists, emphasis and links", () => {
    const html = renderMarkdown("## What we keep\n\nYour **name** and *answers*.\n\n- One\n- Two\n\n[Write to us](mailto:ops@example.org)");
    expect(html).toContain("<h2>What we keep</h2>");
    expect(html).toContain("<p>Your <strong>name</strong> and <em>answers</em>.</p>");
    expect(html).toContain("<ul>\n<li>One</li>\n<li>Two</li>\n</ul>");
    expect(html).toContain('<a href="mailto:ops@example.org">Write to us</a>');
  });

  it("shows markup the operator typed as text, never as markup", () => {
    const html = renderMarkdown('Hello <script>alert("x")</script> and <img src=x onerror=alert(1)>\n\n<div onclick="x()">block</div>');
    expect(html).not.toMatch(/<script|<img|<div/);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;div onclick=&quot;x()&quot;&gt;block&lt;/div&gt;");
  });

  it("makes no link out of a script address", () => {
    for (const markdown of ["[click](javascript:alert(1))", "[click](JAVASCRIPT:alert(1))", "[click](vbscript:msgbox(1))", "[click](data:text/html;base64,PHNjcmlwdD4=)"]) {
      expect(renderMarkdown(markdown)).not.toContain("<a");
    }
  });
});
