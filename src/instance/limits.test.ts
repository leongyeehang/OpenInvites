import { describe, expect, it } from "vitest";
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "@/retention/plan";
import { atLimit, DEFAULT_LIMITS, LIMIT_MAX, LIMIT_MIN, parseLimits } from "./limits";

const fields = (maxEventsPerHost: string, maxRsvpsPerEvent: string, retentionDays = "365", keepForever = false) => ({
  maxEventsPerHost,
  maxRsvpsPerEvent,
  retentionDays,
  keepForever,
});

describe("parseLimits", () => {
  it("reads three whole numbers", () => {
    expect(parseLimits(fields("2", "30", "90"))).toEqual({ ok: true, limits: { maxEventsPerHost: 2, maxRsvpsPerEvent: 30, retentionDays: 90 } });
  });

  it("takes the smallest and the largest value allowed", () => {
    expect(parseLimits(fields(String(LIMIT_MIN), String(LIMIT_MAX)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: LIMIT_MIN, maxRsvpsPerEvent: LIMIT_MAX, retentionDays: 365 },
    });
  });

  it("ignores spaces around a number", () => {
    expect(parseLimits(fields(" 7 ", "8\n", " 60 "))).toEqual({ ok: true, limits: { maxEventsPerHost: 7, maxRsvpsPerEvent: 8, retentionDays: 60 } });
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
    expect(parseLimits(fields("x", "y", "z"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", "y", "z"))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
  });

  it("keeps events from 30 days to ten years after they end", () => {
    expect(parseLimits(fields("5", "5", String(RETENTION_MIN_DAYS)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, retentionDays: RETENTION_MIN_DAYS },
    });
    expect(parseLimits(fields("5", "5", String(RETENTION_MAX_DAYS)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, retentionDays: RETENTION_MAX_DAYS },
    });
  });

  it("refuses days outside that range, a blank, a decimal and words", () => {
    for (const days of [String(RETENTION_MIN_DAYS - 1), String(RETENTION_MAX_DAYS + 1), "", "45.5", "a year"]) {
      expect(parseLimits(fields("5", "5", days))).toEqual({ ok: false, field: "retentionDays" });
    }
  });

  it("keeps events for ever with Keep forever, whatever the days field holds", () => {
    expect(parseLimits(fields("5", "5", "", true))).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, retentionDays: null } });
    expect(parseLimits(fields("5", "5", "7", true))).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, retentionDays: null } });
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
  it("is 50 events per host, 500 replies per event, and events kept a year", () => {
    expect(DEFAULT_LIMITS).toEqual({ maxEventsPerHost: 50, maxRsvpsPerEvent: 500, retentionDays: 365 });
  });
});
