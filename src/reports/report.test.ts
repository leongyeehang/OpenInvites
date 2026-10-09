import { describe, expect, it } from "vitest";
import { parseReport, REASON_MAX, REASON_MIN } from "./report";

const reason = "This page asks guests for their bank details.";

describe("parseReport", () => {
  it("takes the reason and the contact trimmed", () => {
    expect(parseReport({ reason: `  ${reason}\n`, contact: "  ada@example.com " })).toEqual({ ok: true, reason, contact: "ada@example.com" });
  });

  it("keeps no contact as null, a blank one included", () => {
    expect(parseReport({ reason, contact: "" })).toEqual({ ok: true, reason, contact: null });
    expect(parseReport({ reason, contact: "  \t" })).toEqual({ ok: true, reason, contact: null });
  });

  it("wants a reason of at least 20 characters, counted after trimming", () => {
    expect(REASON_MIN).toBe(20);
    expect(parseReport({ reason: "a".repeat(19), contact: "" })).toEqual({ ok: false, error: "reasonTooShort" });
    expect(parseReport({ reason: `  ${"a".repeat(19)}  `, contact: "" })).toEqual({ ok: false, error: "reasonTooShort" });
    expect(parseReport({ reason: "", contact: "" })).toEqual({ ok: false, error: "reasonTooShort" });
    expect(parseReport({ reason: "a".repeat(20), contact: "" })).toMatchObject({ ok: true });
  });

  it("carries at most 1000 characters", () => {
    expect(REASON_MAX).toBe(1000);
    expect(parseReport({ reason: "a".repeat(1000), contact: "" })).toMatchObject({ ok: true });
    expect(parseReport({ reason: "a".repeat(1001), contact: "" })).toEqual({ ok: false, error: "reasonTooLong" });
  });

  it("counts a line break as one character, as the browser posts it or not", () => {
    expect(parseReport({ reason: `${"a".repeat(500)}\r\n${"a".repeat(499)}`, contact: "" })).toMatchObject({ ok: true });
    expect(parseReport({ reason: `${"a".repeat(500)}\r\n${"a".repeat(500)}`, contact: "" })).toEqual({ ok: false, error: "reasonTooLong" });
  });

  it("refuses a contact that is not an email address", () => {
    expect(parseReport({ reason, contact: "ada" })).toEqual({ ok: false, error: "contactInvalid" });
    expect(parseReport({ reason, contact: "ada@example" })).toEqual({ ok: false, error: "contactInvalid" });
    expect(parseReport({ reason, contact: "a b@example.com" })).toEqual({ ok: false, error: "contactInvalid" });
    expect(parseReport({ reason, contact: `${"a".repeat(250)}@b.co` })).toEqual({ ok: false, error: "contactInvalid" });
  });
});
