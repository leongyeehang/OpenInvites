import { describe, expect, it } from "vitest";
import { atLimit, DEFAULT_LIMITS, LIMIT_MAX, LIMIT_MIN, parseLimits } from "./limits";

const fields = (maxEventsPerHost: string, maxRsvpsPerEvent: string) => ({ maxEventsPerHost, maxRsvpsPerEvent });

describe("parseLimits", () => {
  it("reads two whole numbers", () => {
    expect(parseLimits(fields("2", "30"))).toEqual({ ok: true, limits: { maxEventsPerHost: 2, maxRsvpsPerEvent: 30 } });
  });

  it("takes the smallest and the largest value allowed", () => {
    expect(parseLimits(fields(String(LIMIT_MIN), String(LIMIT_MAX)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: LIMIT_MIN, maxRsvpsPerEvent: LIMIT_MAX },
    });
  });

  it("ignores spaces around a number", () => {
    expect(parseLimits(fields(" 7 ", "8\n"))).toEqual({ ok: true, limits: { maxEventsPerHost: 7, maxRsvpsPerEvent: 8 } });
  });

  it("refuses a number below the range or above it, naming the field", () => {
    expect(parseLimits(fields("0", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", String(LIMIT_MAX + 1)))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
    expect(parseLimits(fields("-3", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
  });

  it("refuses a decimal, a blank and letters", () => {
    expect(parseLimits(fields("2.5", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", ""))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
    expect(parseLimits(fields("   ", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("ten", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", "1e3"))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
    expect(parseLimits(fields("5", "0x10"))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
  });

  it("names the first field that is wrong", () => {
    expect(parseLimits(fields("x", "y"))).toEqual({ ok: false, field: "maxEventsPerHost" });
  });
});

describe("atLimit", () => {
  it("is false below the limit and true at it or past it", () => {
    expect(atLimit(1, 2)).toBe(false);
    expect(atLimit(2, 2)).toBe(true);
    expect(atLimit(3, 2)).toBe(true);
  });
});

describe("DEFAULT_LIMITS", () => {
  it("is 50 events per host and 500 replies per event", () => {
    expect(DEFAULT_LIMITS).toEqual({ maxEventsPerHost: 50, maxRsvpsPerEvent: 500 });
  });
});
