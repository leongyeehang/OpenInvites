import { describe, expect, it } from "vitest";
import { fallbackDisplayName } from "./display-name";

describe("fallbackDisplayName", () => {
  it("keeps the name a host already has", () => {
    expect(fallbackDisplayName({ name: "Ada Lovelace", email: "ada@example.com" })).toBe("Ada Lovelace");
  });

  it("falls back to the part of the email before the @ when there is no name", () => {
    expect(fallbackDisplayName({ name: undefined, email: "ada@example.com" })).toBe("ada");
    expect(fallbackDisplayName({ name: null, email: "ada@example.com" })).toBe("ada");
    expect(fallbackDisplayName({ name: "", email: "ada@example.com" })).toBe("ada");
  });

  it("falls back when the name is only whitespace", () => {
    expect(fallbackDisplayName({ name: "   ", email: "ada@example.com" })).toBe("ada");
  });

  it("trims a name that has surrounding whitespace", () => {
    expect(fallbackDisplayName({ name: "  Ada  ", email: "ada@example.com" })).toBe("Ada");
  });
});
