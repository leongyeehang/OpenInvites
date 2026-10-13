import { describe, expect, it } from "vitest";
import { turnstileConfigFromEnv } from "./config";

// Turnstile is on with both of its keys, off with neither (spec, "Turnstile").
describe("turnstileConfigFromEnv", () => {
  it("turns the check on when both keys are set", () => {
    expect(turnstileConfigFromEnv({ TURNSTILE_SITE_KEY: "0x4AAAsite", TURNSTILE_SECRET_KEY: "0x4AAAsecret" })).toEqual({
      siteKey: "0x4AAAsite",
      secretKey: "0x4AAAsecret",
    });
    expect(turnstileConfigFromEnv({ TURNSTILE_SITE_KEY: " 0x4AAAsite ", TURNSTILE_SECRET_KEY: " 0x4AAAsecret\n" })).toEqual({
      siteKey: "0x4AAAsite",
      secretKey: "0x4AAAsecret",
    });
  });

  it("leaves it off when neither is set, or both are blank", () => {
    expect(turnstileConfigFromEnv({})).toBeNull();
    expect(turnstileConfigFromEnv({ TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "  " })).toBeNull();
  });

  it("refuses one key without the other, so the operator finds out at start", () => {
    const together = "TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be set together";
    expect(() => turnstileConfigFromEnv({ TURNSTILE_SITE_KEY: "0x4AAAsite" })).toThrow(together);
    expect(() => turnstileConfigFromEnv({ TURNSTILE_SECRET_KEY: "0x4AAAsecret" })).toThrow(together);
    expect(() => turnstileConfigFromEnv({ TURNSTILE_SITE_KEY: "0x4AAAsite", TURNSTILE_SECRET_KEY: " " })).toThrow(together);
  });
});
