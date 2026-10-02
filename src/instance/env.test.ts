import { afterEach, describe, expect, it, vi } from "vitest";
import { authSecret } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("authSecret", () => {
  it("refuses to start when AUTH_SECRET is unset or blank", () => {
    vi.stubEnv("AUTH_SECRET", undefined);
    expect(() => authSecret()).toThrow("AUTH_SECRET is not set");
    for (const blank of ["", "   "]) {
      vi.stubEnv("AUTH_SECRET", blank);
      expect(() => authSecret()).toThrow("AUTH_SECRET is not set");
    }
  });

  it("refuses a secret shorter than 32 characters", () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(31));
    expect(() => authSecret()).toThrow("AUTH_SECRET must be at least 32 characters");
  });

  it("returns a secret of 32 characters unchanged", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    vi.stubEnv("AUTH_SECRET", secret);
    expect(authSecret()).toBe(secret);
  });

  it("returns the secret as given, spaces and all, so sessions signed with it stay valid", () => {
    const secret = ` ${"s".repeat(32)} `;
    vi.stubEnv("AUTH_SECRET", secret);
    expect(authSecret()).toBe(secret);
  });

  it("keeps the secret out of the message that refuses it", () => {
    vi.stubEnv("AUTH_SECRET", "too-short-to-use");
    let message = "";
    try {
      authSecret();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("AUTH_SECRET must be at least 32 characters");
  });
});
