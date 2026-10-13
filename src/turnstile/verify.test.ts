import { describe, expect, it } from "vitest";
import { turnstileVerdict } from "./verify";

// What Cloudflare's siteverify answered, as JSON: only a success it states outright passes.
describe("turnstileVerdict", () => {
  it("passes a token Cloudflare says succeeded", () => {
    expect(turnstileVerdict({ success: true, "error-codes": [], hostname: "invites.example.org" })).toBe("ok");
  });

  it("fails a token Cloudflare says did not", () => {
    expect(turnstileVerdict({ success: false, "error-codes": ["timeout-or-duplicate"] })).toBe("failed");
  });

  it("fails an answer that says nothing of success, or not in so many words", () => {
    expect(turnstileVerdict({ "error-codes": [] })).toBe("failed");
    expect(turnstileVerdict({ success: "true" })).toBe("failed");
    expect(turnstileVerdict({ success: 1 })).toBe("failed");
  });

  it("fails an answer that is not an object", () => {
    expect(turnstileVerdict(null)).toBe("failed");
    expect(turnstileVerdict(undefined)).toBe("failed");
    expect(turnstileVerdict("success")).toBe("failed");
    expect(turnstileVerdict(true)).toBe("failed");
    expect(turnstileVerdict([{ success: true }])).toBe("failed");
  });
});
