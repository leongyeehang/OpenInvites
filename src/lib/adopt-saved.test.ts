import { describe, expect, it } from "vitest";
import { adoptSaved } from "./adopt-saved";

// A field saved by a server action shows what the server kept, unless the person typed on while it
// was saving (M6 final review, A1).
describe("adoptSaved", () => {
  it("takes what was kept when the field still holds what was sent", () => {
    expect(adoptSaved({ current: "  Dear Mei,\r\n ", submitted: "  Dear Mei,\r\n ", kept: "Dear Mei," })).toBe("Dear Mei,");
  });

  it("keeps what was typed after the field was sent", () => {
    expect(adoptSaved({ current: "Dear Mei, bring", submitted: "Dear Mei,", kept: "Dear Mei," })).toBe("Dear Mei, bring");
  });
});
