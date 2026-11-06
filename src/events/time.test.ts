import { describe, expect, it } from "vitest";
import { eventEnd, formatDay, formatWhenBrief, formatWhen, isTimeZone, partitionByEnd, timeZones, toInstant, toWallTime } from "./time";

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

describe("formatDay", () => {
  it("gives the day in the event's zone, in the reader's language", () => {
    // 20:00 on 12 November in London is already the 13th in Singapore.
    const instant = new Date("2026-11-12T20:00:00Z");
    expect(formatDay(instant, "Asia/Singapore", "en")).toBe("November 13, 2026");
    expect(formatDay(instant, "Europe/London", "en")).toBe("November 12, 2026");
    expect(formatDay(instant, "Asia/Singapore", "zh-Hans")).toBe("2026年11月13日");
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

  it("keeps a draft with no date yet under upcoming, after every dated event", () => {
    const blank = { id: "e", startsAt: null, endsAt: null, ...zone };
    const { upcoming, past } = partitionByEnd([blank, later, ended, endsLater], now);
    expect(upcoming.map((event) => event.id)).toEqual(["b", "c", "e"]);
    expect(past.map((event) => event.id)).toEqual(["a"]);
  });
});

describe("formatWhenBrief", () => {
  const startsAt = new Date("2027-03-06T11:00:00Z"); // 7 PM on Saturday 6 March in Singapore
  const at = (timeZone: string) => ({ startsAt, endsAt: null, allDay: false, timeZone });

  it("gives the start's day, short, and its time, in the event's zone and the guest's language", () => {
    expect(formatWhenBrief(at("Asia/Singapore"), "en")).toBe("Sat, Mar 6 · 7:00 PM");
    // The same instant is still Saturday morning in Los Angeles; in New Zealand it is Sunday.
    expect(formatWhenBrief(at("America/Los_Angeles"), "en")).toBe("Sat, Mar 6 · 3:00 AM");
    expect(formatWhenBrief(at("Pacific/Auckland"), "en")).toBe("Sun, Mar 7 · 12:00 AM");
    expect(formatWhenBrief(at("Asia/Singapore"), "zh-Hans")).toBe("3月6日周六 · 19:00");
  });

  it("adds the year when asked, as the dashboard's tiles do for another year's events", () => {
    expect(formatWhenBrief(at("Asia/Singapore"), "en", { year: true })).toBe("Sat, Mar 6, 2027 · 7:00 PM");
    expect(formatWhenBrief(at("Asia/Singapore"), "zh-Hans", { year: true })).toBe("2027年3月6日周六 · 19:00");
  });

  it("gives an all-day event its days alone", () => {
    const day = new Date("2027-03-05T16:00:00Z"); // midnight on 6 March in Singapore
    expect(formatWhenBrief({ startsAt: day, endsAt: null, allDay: true, timeZone: "Asia/Singapore" }, "en")).toBe("Sat, Mar 6");
    const end = new Date("2027-03-06T16:00:00Z");
    expect(formatWhenBrief({ startsAt: day, endsAt: end, allDay: true, timeZone: "Asia/Singapore" }, "en")).toMatch(/^Sat, Mar 6\s–\sSun, Mar 7$/);
  });
});

