import { describe, expect, it } from "vitest";
import type { EventTime } from "@/events/time";
import { liveWindow, scheduleDays, scheduleInstants, scheduleStates, shouldRefresh } from "./clock";

// A wedding evening in Singapore (UTC+8): 18:00 to 23:00 on 8 May 2027, which is 10:00 to 15:00 UTC.
const ZONE = "Asia/Singapore";
const evening: EventTime = { startsAt: new Date("2027-05-08T10:00:00Z"), endsAt: new Date("2027-05-08T15:00:00Z"), allDay: false, timeZone: ZONE };

// An item on the evening's day, at a wall-clock time in Singapore, with an end when given.
const item = (startTime: string, endTime: string | null = null, day = "2027-05-08") => ({ day, startTime, endTime });

// Each item's state at a moment written in Singapore's time.
const statesAt = (items: ReturnType<typeof item>[], wall: string, event = evening) =>
  scheduleStates(scheduleInstants(items, ZONE), event, new Date(`${wall}+08:00`));

describe("scheduleInstants", () => {
  it("reads each item's day and times in the event's zone, an end left out as none", () => {
    expect(scheduleInstants([item("18:00", "19:00"), item("19:30")], ZONE)).toEqual([
      { start: new Date("2027-05-08T10:00:00Z"), end: new Date("2027-05-08T11:00:00Z") },
      { start: new Date("2027-05-08T11:30:00Z"), end: null },
    ]);
  });
});

describe("scheduleStates", () => {
  const evening3 = [item("18:00", "19:00"), item("19:30"), item("21:00")];

  it("marks nothing as now before the day", () => {
    expect(statesAt(evening3, "2027-05-07T19:00")).toEqual(["upcoming", "upcoming", "upcoming"]);
    expect(statesAt(evening3, "2027-05-08T17:59")).toEqual(["upcoming", "upcoming", "upcoming"]);
  });

  it("makes the first item past once the second starts", () => {
    const items = [item("18:00"), item("19:00")];
    expect(statesAt(items, "2027-05-08T18:00")).toEqual(["now", "upcoming"]);
    expect(statesAt(items, "2027-05-08T18:59")).toEqual(["now", "upcoming"]);
    expect(statesAt(items, "2027-05-08T19:00")).toEqual(["past", "now"]);
  });

  it("makes an item with an end past after it, even when the next has not started", () => {
    expect(statesAt(evening3, "2027-05-08T18:30")).toEqual(["now", "upcoming", "upcoming"]);
    expect(statesAt(evening3, "2027-05-08T19:15")).toEqual(["past", "upcoming", "upcoming"]);
    expect(statesAt(evening3, "2027-05-08T19:30")).toEqual(["past", "now", "upcoming"]);
  });

  it("keeps the last item without an end now until the event's end, then every item is past", () => {
    expect(statesAt(evening3, "2027-05-08T21:00")).toEqual(["past", "past", "now"]);
    expect(statesAt(evening3, "2027-05-08T22:59")).toEqual(["past", "past", "now"]);
    expect(statesAt(evening3, "2027-05-08T23:00")).toEqual(["past", "past", "past"]);
    expect(statesAt(evening3, "2027-05-09T09:00")).toEqual(["past", "past", "past"]);
  });

  it("lets an all-day event's last item run to the next local midnight", () => {
    // 8 May in Singapore, all day: until midnight there, 16:00 UTC.
    const fair = { startsAt: new Date("2027-05-07T16:00:00Z"), endsAt: null, allDay: true, timeZone: ZONE };
    const items = [item("10:00"), item("20:00")];
    expect(statesAt(items, "2027-05-08T23:59", fair)).toEqual(["past", "now"]);
    expect(statesAt(items, "2027-05-09T00:00", fair)).toEqual(["past", "past"]);
  });

  it("makes two items at one time both now, and both past when the next starts", () => {
    const items = [item("19:00"), item("19:00"), item("20:00")];
    expect(statesAt(items, "2027-05-08T19:30")).toEqual(["now", "now", "upcoming"]);
    expect(statesAt(items, "2027-05-08T20:00")).toEqual(["past", "past", "now"]);
  });
});

describe("scheduleDays", () => {
  it("makes a one-day list one group, which has no day heading to give", () => {
    const items = [item("18:00"), item("21:00")];
    expect(scheduleDays(items)).toEqual([{ day: "2027-05-08", items }]);
  });

  it("groups a two-day list by day, in order", () => {
    const [dinner, cake, brunch] = [item("19:00"), item("21:00"), item("10:00", null, "2027-05-09")];
    expect(scheduleDays([dinner, cake, brunch])).toEqual([
      { day: "2027-05-08", items: [dinner, cake] },
      { day: "2027-05-09", items: [brunch] },
    ]);
  });
});

describe("liveWindow", () => {
  it("runs from the earlier of the event's start and the first item's to the event's end", () => {
    const early = scheduleInstants([item("17:00"), item("19:00")], ZONE);
    expect(liveWindow(early, evening)).toEqual({ from: new Date("2027-05-08T09:00:00Z"), to: evening.endsAt });
    const late = scheduleInstants([item("19:00")], ZONE);
    expect(liveWindow(late, evening)).toEqual({ from: evening.startsAt, to: evening.endsAt });
  });
});

describe("shouldRefresh", () => {
  const window = { from: new Date("2027-05-08T10:00:00Z"), to: new Date("2027-05-08T15:00:00Z") };
  const before = new Date("2027-05-08T09:59:00Z");
  const during = new Date("2027-05-08T12:00:00Z");
  const after = new Date("2027-05-08T15:00:00Z");

  it("never refreshes under reload", () => {
    for (const now of [before, during, after]) {
      for (const visible of [true, false]) expect(shouldRefresh({ refresh: "reload", now, window, visible })).toBe(false);
    }
  });

  it("refreshes under minute only inside the window, while the page is visible", () => {
    expect(shouldRefresh({ refresh: "minute", now: during, window, visible: true })).toBe(true);
    expect(shouldRefresh({ refresh: "minute", now: window.from, window, visible: true })).toBe(true);
    expect(shouldRefresh({ refresh: "minute", now: during, window, visible: false })).toBe(false);
    expect(shouldRefresh({ refresh: "minute", now: before, window, visible: true })).toBe(false);
    expect(shouldRefresh({ refresh: "minute", now: after, window, visible: true })).toBe(false);
  });
});
