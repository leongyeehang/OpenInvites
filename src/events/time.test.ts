import { describe, expect, it } from "vitest";
import { eventEnd, formatWhen, isTimeZone, partitionByEnd, timeZones, toInstant, toWallTime } from "./time";

describe("toInstant", () => {
  it("reads a wall-clock time in the event's zone", () => {
    expect(toInstant("2026-10-03T19:00", "Asia/Singapore").toISOString()).toBe("2026-10-03T11:00:00.000Z");
  });

  it("applies summer time where the zone has it", () => {
    expect(toInstant("2026-07-01T12:00", "Europe/London").toISOString()).toBe("2026-07-01T11:00:00.000Z");
    expect(toInstant("2026-01-15T12:00", "Europe/London").toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });

  it("takes a bare date as midnight in the zone", () => {
    expect(toInstant("2026-10-03", "Asia/Singapore").toISOString()).toBe("2026-10-02T16:00:00.000Z");
  });

  it("is undone by toWallTime", () => {
    const instant = toInstant("2026-10-03T19:30", "America/New_York");
    expect(toWallTime(instant, "America/New_York")).toBe("2026-10-03T19:30");
    expect(toWallTime(instant, "America/New_York", { dateOnly: true })).toBe("2026-10-03");
  });
});

describe("isTimeZone", () => {
  it("accepts IANA names and rejects the rest", () => {
    expect(isTimeZone("Asia/Singapore")).toBe(true);
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });

  it("accepts UTC and the aliases browsers report, and offers UTC in the list", () => {
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Asia/Kolkata")).toBe(true);
    expect(timeZones()).toContain("UTC");
    expect(timeZones()).toContain("Asia/Singapore");
  });
});

describe("formatWhen", () => {
  const singapore = { timeZone: "Asia/Singapore", allDay: false, endsAt: null };

  it("shows a timed event in the event's zone with the zone named", () => {
    const text = formatWhen({ ...singapore, startsAt: new Date("2026-10-03T11:00:00Z") }, "en");
    expect(text).toContain("October 3, 2026");
    expect(text).toContain("7:00");
    expect(text).toMatch(/GMT\+8|SGT/);
  });

  it("shows a range when the event has an end", () => {
    const text = formatWhen(
      { ...singapore, startsAt: new Date("2026-10-03T11:00:00Z"), endsAt: new Date("2026-10-03T14:00:00Z") },
      "en",
    );
    expect(text).toContain("7:00");
    expect(text).toContain("10:00");
  });

  it("shows only dates for an all-day event", () => {
    const text = formatWhen(
      { ...singapore, allDay: true, startsAt: new Date("2026-10-02T16:00:00Z"), endsAt: null },
      "en",
    );
    expect(text).toContain("October 3, 2026");
    expect(text).not.toMatch(/\d:\d\d/);
  });
});

describe("eventEnd", () => {
  it("is the end when there is one, else the start", () => {
    const start = new Date("2026-10-03T11:00:00Z");
    const end = new Date("2026-10-03T14:00:00Z");
    expect(eventEnd({ startsAt: start, endsAt: end, allDay: false, timeZone: "Asia/Singapore" })).toEqual(end);
    expect(eventEnd({ startsAt: start, endsAt: null, allDay: false, timeZone: "Asia/Singapore" })).toEqual(start);
  });

  it("lasts until the end of the day for an all-day event", () => {
    const midnight = new Date("2026-10-02T16:00:00Z");
    expect(eventEnd({ startsAt: midnight, endsAt: null, allDay: true, timeZone: "Asia/Singapore" }).toISOString()).toBe(
      "2026-10-03T16:00:00.000Z",
    );
  });
});

describe("eventEnd across a clock change", () => {
  it("ends at the next local midnight, not 24 hours later", () => {
    // London, 29 March 2026: the clocks go forward, so the day has 23 hours.
    const midnight = toInstant("2026-03-29", "Europe/London");
    expect(eventEnd({ startsAt: midnight, endsAt: null, allDay: true, timeZone: "Europe/London" }).toISOString()).toBe(
      "2026-03-29T23:00:00.000Z",
    );
  });
});

describe("partitionByEnd", () => {
  const zone = { allDay: false, timeZone: "Asia/Singapore" };
  const now = new Date("2026-10-01T00:00:00Z");
  const ended = { id: "a", startsAt: new Date("2026-09-01T10:00:00Z"), endsAt: null, ...zone };
  const endsLater = { id: "b", startsAt: new Date("2026-09-30T22:00:00Z"), endsAt: new Date("2026-10-01T02:00:00Z"), ...zone };
  const later = { id: "c", startsAt: new Date("2026-11-01T10:00:00Z"), endsAt: null, ...zone };
  const longAgo = { id: "d", startsAt: new Date("2025-01-01T10:00:00Z"), endsAt: null, ...zone };

  it("keeps an event that is still running under upcoming and lists past events most recent first", () => {
    const { upcoming, past } = partitionByEnd([longAgo, ended, endsLater, later], now);
    expect(upcoming.map((event) => event.id)).toEqual(["b", "c"]);
    expect(past.map((event) => event.id)).toEqual(["a", "d"]);
  });
});
