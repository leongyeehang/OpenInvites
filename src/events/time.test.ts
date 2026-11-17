import { describe, expect, it } from "vitest";
import { eventEnd, formatDay, formatMoment, formatWhenBrief, formatWhen, isTimeZone, parseWallTime, partitionByEnd, timeZones, toInstant, toWallTime } from "./time";

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

// A date and time typed in the event's zone, as the event form and the album vote's closing time
// read it (the voting part's review, test gap 2).
describe("parseWallTime", () => {
  it("reads a time in a zone west of UTC and one east of it", () => {
    expect(parseWallTime("2026-11-20T18:00", "America/New_York")?.toISOString()).toBe("2026-11-20T23:00:00.000Z");
    expect(parseWallTime("2026-07-20T18:00", "America/Los_Angeles")?.toISOString()).toBe("2026-07-21T01:00:00.000Z");
    expect(parseWallTime("2026-11-20T18:00", "Asia/Tokyo")?.toISOString()).toBe("2026-11-20T09:00:00.000Z");
  });

  it("reads a zone with an odd offset", () => {
    expect(parseWallTime("2026-11-20T18:00", "Asia/Kathmandu")?.toISOString()).toBe("2026-11-20T12:15:00.000Z");
    expect(parseWallTime("2026-11-20T18:00", "Asia/Kolkata")?.toISOString()).toBe("2026-11-20T12:30:00.000Z");
    expect(parseWallTime("2026-11-20T18:00", "Australia/Lord_Howe")?.toISOString()).toBe("2026-11-20T07:00:00.000Z");
  });

  it("refuses an hour the clocks skip", () => {
    expect(parseWallTime("2027-03-14T02:30", "America/New_York")).toBeUndefined();
    expect(parseWallTime("2027-03-28T01:30", "Europe/London")).toBeUndefined();
    expect(parseWallTime("2027-03-14T03:30", "America/New_York")?.toISOString()).toBe("2027-03-14T07:30:00.000Z");
  });

  // Re-review follow-up: a wall time the clocks skip resolves forward, by the offset before the
  // change, for callers that do not refuse it; parseWallTime refuses one with a time.
  it("reads a skipped time forward, and accepts a day whose midnight is skipped as its first hour", () => {
    expect(toInstant("2027-03-14T02:30", "America/New_York").toISOString()).toBe("2027-03-14T07:30:00.000Z");
    const day = parseWallTime("2026-09-06", "America/Santiago", { dateOnly: true });
    expect(day?.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(toWallTime(day!, "America/Santiago")).toBe("2026-09-06T01:00");
    expect(parseWallTime("2026-09-06T00:30", "America/Santiago")).toBeUndefined();
  });

  it("takes the first of an hour that comes twice", () => {
    expect(parseWallTime("2027-11-07T01:30", "America/New_York")?.toISOString()).toBe("2027-11-07T05:30:00.000Z");
    expect(parseWallTime("2027-10-31T01:30", "Europe/London")?.toISOString()).toBe("2027-10-31T00:30:00.000Z");
    expect(parseWallTime("2027-04-04T02:30", "Pacific/Auckland")?.toISOString()).toBe("2027-04-03T13:30:00.000Z");
  });

  it("refuses what is not a date and time, and a date alone unless a date is asked for", () => {
    for (const wall of ["", "soon", "2026-02-30T10:00", "2026-11-20T24:30", "2026-11-20T18:00:00", "2026-11-20 18:00"]) {
      expect(parseWallTime(wall, "America/New_York")).toBeUndefined();
    }
    expect(parseWallTime("2026-11-20", "America/New_York")).toBeUndefined();
    expect(parseWallTime("2026-11-20", "America/New_York", { dateOnly: true })?.toISOString()).toBe("2026-11-20T05:00:00.000Z");
    expect(parseWallTime("2026-11-20T18:00", "America/New_York", { dateOnly: true })?.toISOString()).toBe("2026-11-20T05:00:00.000Z");
  });
});

describe("formatMoment", () => {
  const at = new Date("2026-11-20T23:00:00Z");

  it("writes a moment in the event's zone", () => {
    expect(formatMoment(at, "America/New_York", "en")).toBe("Nov 20, 6:00 PM");
  });

  it("names the zone when asked, for a guest who may be elsewhere (the voting part's review)", () => {
    expect(formatMoment(at, "America/New_York", "en", { zone: true })).toBe("Nov 20, 6:00 PM EST");
    expect(formatMoment(new Date("2026-07-20T23:00:00Z"), "America/New_York", "en", { zone: true })).toBe("Jul 20, 7:00 PM EDT");
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

