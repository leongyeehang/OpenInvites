import { describe, expect, it } from "vitest";
import { albumReminderDue, remindersDue, type RemindedAlbum } from "./reminders";

// The album's reminder (M7 ticket 09; spec, "Clearing up"): so many days after the event ends, its
// hosts are reminded once to empty the album or keep it. Nothing is deleted by the clock.

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-09T09:00:00Z");
const daysBefore = (time: Date, days: number) => new Date(time.getTime() - days * DAY);

// An evening event in Singapore that ended at `end`, with `items` in its album.
function ended(id: string, end: Date, days: number | null, items = 3, remindedAt: Date | null = null): RemindedAlbum {
  return { id, startsAt: daysBefore(end, 0.125), endsAt: end, allDay: false, timeZone: "Asia/Singapore", albumReminderDays: days, albumRemindedAt: remindedAt, items };
}

describe("albumReminderDue", () => {
  it("is so many days after the event's end", () => {
    const end = new Date("2026-09-10T13:00:00Z");
    expect(albumReminderDue(ended("party", end, 60))).toEqual(new Date("2026-11-09T13:00:00Z"));
  });

  it("counts from the end of an all-day event's day in its own zone", () => {
    const allDay: RemindedAlbum = { id: "fair", startsAt: new Date("2026-09-10T00:00:00Z"), endsAt: null, allDay: true, timeZone: "Asia/Singapore", albumReminderDays: 30, albumRemindedAt: null, items: 1 };
    // The day ends at midnight in Singapore, 16:00 UTC the same day.
    expect(albumReminderDue(allDay)).toEqual(new Date("2026-10-10T16:00:00Z"));
  });

  it("is never for an event that never reminds, or a draft with no date", () => {
    expect(albumReminderDue(ended("never", NOW, null))).toBeUndefined();
    expect(albumReminderDue({ ...ended("draft", NOW, 60), startsAt: null })).toBeUndefined();
  });
});

describe("remindersDue", () => {
  it("names the events whose day has come, holding something, not yet reminded", () => {
    const due = ended("due", daysBefore(NOW, 60), 60);
    const early = ended("early", daysBefore(NOW, 59), 60);
    expect(remindersDue([due, early], NOW)).toEqual(["due"]);
  });

  it("leaves an empty album alone, however old", () => {
    expect(remindersDue([ended("empty", daysBefore(NOW, 400), 60, 0)], NOW)).toEqual([]);
  });

  it("never reminds twice", () => {
    expect(remindersDue([ended("done", daysBefore(NOW, 400), 60, 3, daysBefore(NOW, 300))], NOW)).toEqual([]);
  });

  it("skips what never reminds and what has no date", () => {
    expect(remindersDue([ended("never", daysBefore(NOW, 400), null), { ...ended("draft", daysBefore(NOW, 400), 60), startsAt: null }], NOW)).toEqual([]);
  });
});
