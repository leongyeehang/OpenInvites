import { describe, expect, it } from "vitest";
import { remindersDue, type ReminderEvent } from "./due";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Ada's birthday, Saturday 13 March 2027 at 19:00 in Singapore, published well over a week ahead.
const START = new Date("2027-03-13T11:00:00Z");
const WEEK_BEFORE = new Date(START.getTime() - 7 * DAY);
const DAY_BEFORE = new Date(START.getTime() - DAY);

function event(overrides: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    state: "published",
    remindersEnabled: true,
    startsAt: START,
    allDay: false,
    timeZone: "Asia/Singapore",
    publishedAt: new Date("2027-02-01T03:00:00Z"),
    weekReminderSentAt: null,
    dayReminderSentAt: null,
    ...overrides,
  };
}

const at = (time: Date, offset = 0) => new Date(time.getTime() + offset);

describe("remindersDue", () => {
  it("reminds a week before the start, and not a minute sooner", () => {
    expect(remindersDue(event(), at(WEEK_BEFORE, -60_000))).toEqual([]);
    expect(remindersDue(event(), WEEK_BEFORE)).toEqual(["week"]);
  });

  it("reminds the day before the start, and not a minute sooner", () => {
    expect(remindersDue(event(), at(DAY_BEFORE, -60_000))).toEqual([]);
    expect(remindersDue(event(), DAY_BEFORE)).toEqual(["day"]);
  });

  it("still sends a reminder after an outage of less than a day", () => {
    expect(remindersDue(event(), at(WEEK_BEFORE, 23 * HOUR + 59 * 60_000))).toEqual(["week"]);
    expect(remindersDue(event(), at(DAY_BEFORE, 23 * HOUR))).toEqual(["day"]);
  });

  it("does not send a reminder 25 hours past its time, when it would no longer be true", () => {
    expect(remindersDue(event(), at(WEEK_BEFORE, 25 * HOUR))).toEqual([]);
  });

  it("stops at 24 hours past its time", () => {
    expect(remindersDue(event(), at(WEEK_BEFORE, DAY))).toEqual([]);
  });

  it("never sends the week reminder for an event published five days out, but sends the day reminder", () => {
    const published = event({ publishedAt: at(START, -5 * DAY) });
    expect(remindersDue(published, at(START, -5 * DAY + 60_000))).toEqual([]);
    expect(remindersDue(published, DAY_BEFORE)).toEqual(["day"]);
  });

  it("never sends the week reminder for an event published within the day after its time", () => {
    const published = event({ publishedAt: at(WEEK_BEFORE, 12 * HOUR) });
    expect(remindersDue(published, at(WEEK_BEFORE, 12 * HOUR + 60_000))).toEqual([]);
  });

  it("never sends the day reminder for an event published less than a day out", () => {
    const published = event({ publishedAt: at(START, -23 * HOUR) });
    expect(remindersDue(published, at(START, -23 * HOUR + 60_000))).toEqual([]);
  });

  it("sends nothing for an event published at the very moment a reminder falls due", () => {
    expect(remindersDue(event({ publishedAt: DAY_BEFORE }), DAY_BEFORE)).toEqual([]);
  });

  it("sends nothing for an event that was never published", () => {
    expect(remindersDue(event({ state: "draft", publishedAt: null }), DAY_BEFORE)).toEqual([]);
  });

  it("sends nothing for a cancelled event", () => {
    expect(remindersDue(event({ state: "cancelled" }), WEEK_BEFORE)).toEqual([]);
    expect(remindersDue(event({ state: "cancelled" }), DAY_BEFORE)).toEqual([]);
  });

  it("sends nothing when the host has turned reminders off, even after one was sent", () => {
    expect(remindersDue(event({ remindersEnabled: false }), WEEK_BEFORE)).toEqual([]);
    expect(remindersDue(event({ remindersEnabled: false, weekReminderSentAt: WEEK_BEFORE }), DAY_BEFORE)).toEqual([]);
  });

  it("sends each reminder once", () => {
    expect(remindersDue(event({ weekReminderSentAt: WEEK_BEFORE }), at(WEEK_BEFORE, HOUR))).toEqual([]);
    expect(remindersDue(event({ dayReminderSentAt: DAY_BEFORE }), at(DAY_BEFORE, HOUR))).toEqual([]);
    expect(remindersDue(event({ weekReminderSentAt: WEEK_BEFORE }), DAY_BEFORE)).toEqual(["day"]);
  });

  it("reminds of an all-day event from midnight in the event's zone", () => {
    // Saturday 13 March 2027, all day in Singapore: it starts at midnight there.
    const allDay = event({ allDay: true, startsAt: new Date("2027-03-12T16:00:00Z") });
    expect(remindersDue(allDay, new Date("2027-03-05T15:59:00Z"))).toEqual([]);
    expect(remindersDue(allDay, new Date("2027-03-05T16:00:00Z"))).toEqual(["week"]);
    expect(remindersDue(allDay, new Date("2027-03-11T15:59:00Z"))).toEqual([]);
    expect(remindersDue(allDay, new Date("2027-03-11T16:00:00Z"))).toEqual(["day"]);
  });

  it("counts an all-day event's days on the event's own calendar when its clocks change", () => {
    // Monday 15 March 2027, all day in New York, where the clocks went forward on the 14th: the day
    // before begins at midnight on the 14th, 23 hours before the event and not 24.
    const allDay = event({ allDay: true, timeZone: "America/New_York", startsAt: new Date("2027-03-15T04:00:00Z") });
    expect(remindersDue(allDay, new Date("2027-03-14T04:30:00Z"))).toEqual([]);
    expect(remindersDue(allDay, new Date("2027-03-14T05:00:00Z"))).toEqual(["day"]);
    expect(remindersDue(allDay, new Date("2027-03-08T04:30:00Z"))).toEqual([]);
    expect(remindersDue(allDay, new Date("2027-03-08T05:00:00Z"))).toEqual(["week"]);
  });
});
