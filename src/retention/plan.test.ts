import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETENTION_DAYS,
  deletionDate,
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  retentionPlan,
  staleMarks,
  WARNING_DAYS,
  type RetainedEvent,
} from "./plan";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-13T09:00:00Z");

const daysBefore = (time: Date, days: number) => new Date(time.getTime() - days * DAY);
const daysAfter = (time: Date, days: number) => new Date(time.getTime() + days * DAY);
const at = (time: Date, offset: number) => new Date(time.getTime() + offset);

// An evening event in Singapore that ended at `end`, marked at `warned` if it was.
function ended(id: string, end: Date, warned: Date | null = null): RetainedEvent {
  return { id, startsAt: daysBefore(end, 0.125), endsAt: end, allDay: false, timeZone: "Asia/Singapore", retentionWarnedAt: warned };
}

const NOTHING = { warn: [], remove: [] };

describe("retentionPlan", () => {
  it("marks and deletes nothing when the instance keeps events forever", () => {
    const events = [ended("old", daysBefore(NOW, 5000)), ended("marked", daysBefore(NOW, 5000), daysBefore(NOW, 400))];
    expect(retentionPlan(events, NOW, null)).toEqual(NOTHING);
  });

  it("only marks an event that ended two years ago, on a fresh instance as on the first sweep after an upgrade", () => {
    expect(retentionPlan([ended("party", daysBefore(NOW, 730))], NOW, DEFAULT_RETENTION_DAYS)).toEqual({ warn: ["party"], remove: [] });
  });

  it("marks an event 30 days before its period is up, and not a moment sooner", () => {
    const due = daysBefore(NOW, DEFAULT_RETENTION_DAYS - WARNING_DAYS);
    expect(retentionPlan([ended("due", due)], NOW, DEFAULT_RETENTION_DAYS)).toEqual({ warn: ["due"], remove: [] });
    expect(retentionPlan([ended("early", at(due, 1))], NOW, DEFAULT_RETENTION_DAYS)).toEqual(NOTHING);
  });

  it("marks an event once", () => {
    expect(retentionPlan([ended("party", daysBefore(NOW, 730), daysBefore(NOW, 1))], NOW, DEFAULT_RETENTION_DAYS)).toEqual(NOTHING);
  });

  it("deletes a marked event once the mark is 30 days old, and not a moment sooner", () => {
    const warned = daysBefore(NOW, WARNING_DAYS);
    expect(retentionPlan([ended("party", daysBefore(NOW, 730), warned)], NOW, DEFAULT_RETENTION_DAYS)).toEqual({ warn: [], remove: ["party"] });
    expect(retentionPlan([ended("party", daysBefore(NOW, 730), at(warned, 1))], NOW, DEFAULT_RETENTION_DAYS)).toEqual(NOTHING);
  });

  it("puts the deletion off when the period is raised after the mark", () => {
    // Ended 400 days ago and marked 35 days ago: due under a year, not under two.
    const end = daysBefore(NOW, 400);
    const party = ended("party", end, daysBefore(NOW, 35));
    expect(retentionPlan([party], NOW, 365)).toEqual({ warn: [], remove: ["party"] });
    expect(retentionPlan([party], NOW, 730)).toEqual(NOTHING);
    expect(retentionPlan([party], at(daysAfter(end, 730), -1), 730)).toEqual(NOTHING);
    expect(retentionPlan([party], daysAfter(end, 730), 730)).toEqual({ warn: [], remove: ["party"] });
  });

  it("deletes no sooner than 30 days after the mark when the period is lowered", () => {
    // Marked 10 days ago under a year; the operator then lowers the period to the least it can be.
    const warned = daysBefore(NOW, 10);
    const party = ended("party", daysBefore(NOW, 400), warned);
    expect(retentionPlan([party], NOW, RETENTION_MIN_DAYS)).toEqual(NOTHING);
    expect(retentionPlan([party], at(daysAfter(warned, WARNING_DAYS), -1), RETENTION_MIN_DAYS)).toEqual(NOTHING);
    expect(retentionPlan([party], daysAfter(warned, WARNING_DAYS), RETENTION_MIN_DAYS)).toEqual({ warn: [], remove: ["party"] });
  });

  it("marks at once an event that ended yesterday when the period is the least it can be", () => {
    expect(retentionPlan([ended("yesterday", daysBefore(NOW, 1))], NOW, RETENTION_MIN_DAYS)).toEqual({ warn: ["yesterday"], remove: [] });
  });

  it("counts an all-day event from the end of its day, in its own zone", () => {
    // All day on Wednesday 1 October 2025 in Singapore: kept as that day's midnight, over at the next.
    const beach: RetainedEvent = {
      id: "beach",
      startsAt: new Date("2025-09-30T16:00:00Z"),
      endsAt: null,
      allDay: true,
      timeZone: "Asia/Singapore",
      retentionWarnedAt: null,
    };
    const over = new Date("2025-10-01T16:00:00Z");
    const markedAt = daysAfter(over, DEFAULT_RETENTION_DAYS - WARNING_DAYS);
    expect(retentionPlan([beach], at(markedAt, -1), DEFAULT_RETENTION_DAYS)).toEqual(NOTHING);
    expect(retentionPlan([beach], markedAt, DEFAULT_RETENTION_DAYS)).toEqual({ warn: ["beach"], remove: [] });
  });

  it("deletes as soon as the next sweep with a floor of 0 days, and marks no sooner for it", () => {
    // The test profile's app-no-mail runs with no floor, so its browser test sees the deletion.
    const marked = ended("party", daysBefore(NOW, 730), NOW);
    expect(retentionPlan([marked], NOW, DEFAULT_RETENTION_DAYS, 0)).toEqual({ warn: [], remove: ["party"] });
    const early = ended("early", at(daysBefore(NOW, DEFAULT_RETENTION_DAYS - WARNING_DAYS), 1));
    expect(retentionPlan([early], NOW, DEFAULT_RETENTION_DAYS, 0)).toEqual(NOTHING);
  });

  it("sorts several events at once, each into one set or none", () => {
    const events = [
      ended("recent", daysBefore(NOW, 10)),
      ended("old", daysBefore(NOW, 730)),
      ended("waiting", daysBefore(NOW, 730), daysBefore(NOW, 5)),
      ended("gone", daysBefore(NOW, 730), daysBefore(NOW, 31)),
    ];
    expect(retentionPlan(events, NOW, DEFAULT_RETENTION_DAYS)).toEqual({ warn: ["old"], remove: ["gone"] });
  });
});

describe("deletionDate", () => {
  it("is none before the mark, and none when the instance keeps events forever", () => {
    expect(deletionDate(ended("party", daysBefore(NOW, 730)), DEFAULT_RETENTION_DAYS)).toBeUndefined();
    expect(deletionDate(ended("party", daysBefore(NOW, 730), NOW), null)).toBeUndefined();
  });

  it("is 30 days after the mark when the period was up before it", () => {
    expect(deletionDate(ended("party", daysBefore(NOW, 730), NOW), DEFAULT_RETENTION_DAYS)).toEqual(daysAfter(NOW, WARNING_DAYS));
  });

  it("is the end and the period when that comes later, as after the period is raised", () => {
    const end = daysBefore(NOW, 400);
    expect(deletionDate(ended("party", end, daysBefore(NOW, 35)), 730)).toEqual(daysAfter(end, 730));
  });

  it("counts an all-day event from the end of its day", () => {
    const beach = { startsAt: new Date("2025-09-30T16:00:00Z"), endsAt: null, allDay: true, timeZone: "Asia/Singapore", retentionWarnedAt: NOW };
    expect(deletionDate(beach, 3650)).toEqual(daysAfter(new Date("2025-10-01T16:00:00Z"), 3650));
  });

  it("is the mark itself with a floor of 0 days, when the period was up before it", () => {
    expect(deletionDate(ended("party", daysBefore(NOW, 730), NOW), DEFAULT_RETENTION_DAYS, 0)).toEqual(NOW);
  });
});

describe("staleMarks", () => {
  it("is every mark when the instance keeps events forever", () => {
    const events = [ended("old", daysBefore(NOW, 5000), daysBefore(NOW, 3)), ended("recent", daysBefore(NOW, 400), daysBefore(NOW, 40))];
    expect(staleMarks(events, NOW, null)).toEqual(["old", "recent"]);
  });

  it("is the marks of events a longer period takes back out of their last 30 days", () => {
    // Both marked under a year; the period raised to two: one is still within 30 days of it.
    const events = [ended("out", daysBefore(NOW, 400), daysBefore(NOW, 35)), ended("in", daysBefore(NOW, 720), daysBefore(NOW, 35))];
    expect(staleMarks(events, NOW, 730)).toEqual(["out"]);
  });

  it("keeps a mark whose end is the period less 30 days ago to the moment, and not a moment later", () => {
    const edge = daysBefore(NOW, 730 - WARNING_DAYS);
    expect(staleMarks([ended("edge", edge, daysBefore(NOW, 1))], NOW, 730)).toEqual([]);
    expect(staleMarks([ended("after", at(edge, 1), daysBefore(NOW, 1))], NOW, 730)).toEqual(["after"]);
  });

  it("is nothing when the period is lowered, and never an event that is not marked", () => {
    const events = [ended("marked", daysBefore(NOW, 400), daysBefore(NOW, 10)), ended("unmarked", daysBefore(NOW, 10))];
    expect(staleMarks(events, NOW, RETENTION_MIN_DAYS)).toEqual([]);
    expect(staleMarks(events, NOW, null)).toEqual(["marked"]);
  });

  it("counts an all-day event from the end of its day", () => {
    // All day on 1 October 2025 in Singapore, over at the next midnight; marked, then the period
    // set so that its last 30 days begin exactly then.
    const beach: RetainedEvent = {
      id: "beach",
      startsAt: new Date("2025-09-30T16:00:00Z"),
      endsAt: null,
      allDay: true,
      timeZone: "Asia/Singapore",
      retentionWarnedAt: daysBefore(NOW, 1),
    };
    const over = new Date("2025-10-01T16:00:00Z");
    expect(staleMarks([beach], daysAfter(over, 335), DEFAULT_RETENTION_DAYS)).toEqual([]);
    expect(staleMarks([beach], at(daysAfter(over, 335), -1), DEFAULT_RETENTION_DAYS)).toEqual(["beach"]);
  });
});

describe("the period", () => {
  it("is a year by default, from 30 days to ten years, with a warning 30 days before", () => {
    expect([DEFAULT_RETENTION_DAYS, RETENTION_MIN_DAYS, RETENTION_MAX_DAYS, WARNING_DAYS]).toEqual([365, 30, 3650, 30]);
  });
});
