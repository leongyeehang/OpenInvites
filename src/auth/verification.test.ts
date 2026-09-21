import { describe, expect, it } from "vitest";
import { needsEmailVerification } from "./verification";

describe("needsEmailVerification", () => {
  it("asks an unverified host to verify when the instance has mail", () => {
    expect(needsEmailVerification({ mailConfigured: true, emailVerified: false })).toBe(true);
  });

  it("leaves a verified host alone", () => {
    expect(needsEmailVerification({ mailConfigured: true, emailVerified: true })).toBe(false);
  });

  it("skips verification entirely when the instance has no mail", () => {
    expect(needsEmailVerification({ mailConfigured: false, emailVerified: false })).toBe(false);
  });
});
