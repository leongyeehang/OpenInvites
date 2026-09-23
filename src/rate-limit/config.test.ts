import { describe, expect, it } from "vitest";
import { rateLimitConfigFromEnv } from "./config";

const MINUTE = 60_000;

describe("rateLimitConfigFromEnv", () => {
  it("has a limit for everything it protects when nothing is set, behind one reverse proxy", () => {
    expect(rateLimitConfigFromEnv({})).toEqual({
      trustedProxyHops: 1,
      rules: {
        eventPage: { limit: 120, windowMs: MINUTE },
        rsvp: { limit: 60, windowMs: 10 * MINUTE },
        upload: { limit: 20, windowMs: 10 * MINUTE },
        signUp: { limit: 10, windowMs: 60 * MINUTE },
        signIn: { limit: 10, windowMs: 15 * MINUTE },
        passwordReset: { limit: 10, windowMs: 60 * MINUTE },
        mail: { limit: 10, windowMs: 60 * MINUTE },
      },
    });
  });

  it("takes each limit as a count per window, in seconds, minutes, or hours", () => {
    const { rules } = rateLimitConfigFromEnv({
      RATE_LIMIT_EVENT_PAGE: "30/1m",
      RATE_LIMIT_RSVP: " 5 / 90s ",
      RATE_LIMIT_UPLOAD: "2/2h",
      RATE_LIMIT_SIGN_UP: "3/1h",
      RATE_LIMIT_SIGN_IN: "4/10m",
      RATE_LIMIT_PASSWORD_RESET: "1/30s",
      RATE_LIMIT_MAIL: "6/1h",
    });
    expect(rules).toEqual({
      eventPage: { limit: 30, windowMs: MINUTE },
      rsvp: { limit: 5, windowMs: 90_000 },
      upload: { limit: 2, windowMs: 120 * MINUTE },
      signUp: { limit: 3, windowMs: 60 * MINUTE },
      signIn: { limit: 4, windowMs: 10 * MINUTE },
      passwordReset: { limit: 1, windowMs: 30_000 },
      mail: { limit: 6, windowMs: 60 * MINUTE },
    });
  });

  it("keeps the default for a limit left blank", () => {
    expect(rateLimitConfigFromEnv({ RATE_LIMIT_RSVP: "  " }).rules.rsvp).toEqual({ limit: 60, windowMs: 10 * MINUTE });
  });

  it("refuses a limit it cannot read, naming the setting, so the operator finds out at start", () => {
    for (const setting of ["20", "20/10", "/10m", "0/10m", "20/0m", "20/10d", "-5/10m", "2.5/10m", "twenty/10m"]) {
      expect(() => rateLimitConfigFromEnv({ RATE_LIMIT_SIGN_IN: setting })).toThrow(/RATE_LIMIT_SIGN_IN/);
      expect(() => rateLimitConfigFromEnv({ RATE_LIMIT_MAIL: setting })).toThrow(/RATE_LIMIT_MAIL/);
    }
  });

  it("takes the number of reverse proxies in front of the app, none included", () => {
    expect(rateLimitConfigFromEnv({ TRUSTED_PROXY_HOPS: "0" }).trustedProxyHops).toBe(0);
    expect(rateLimitConfigFromEnv({ TRUSTED_PROXY_HOPS: " 2 " }).trustedProxyHops).toBe(2);
    expect(rateLimitConfigFromEnv({ TRUSTED_PROXY_HOPS: "" }).trustedProxyHops).toBe(1);
  });

  it("refuses a number of proxies that is not a whole number", () => {
    for (const setting of ["-1", "1.5", "one", "2 proxies"]) {
      expect(() => rateLimitConfigFromEnv({ TRUSTED_PROXY_HOPS: setting })).toThrow(/TRUSTED_PROXY_HOPS/);
    }
  });
});
