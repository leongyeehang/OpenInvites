import type { Event } from "@/events/repository";
import { toInstant, toWallTime } from "@/events/time";
import type { RsvpStatus } from "@/rsvps/form";

// The fixed cadence (spec, "Automatic reminders"): a week before the start to the guests who said
// Maybe, the day before to those who said Going.
export const REMINDERS = {
  week: { daysBefore: 7, status: "maybe" },
  day: { daysBefore: 1, status: "going" },
} as const satisfies Record<string, { daysBefore: number; status: RsvpStatus }>;

export type ReminderKind = keyof typeof REMINDERS;

const KINDS: ReminderKind[] = ["week", "day"];

const DAY = 24 * 60 * 60 * 1000;

// What deciding which reminders are due needs of an event.
export type ReminderEvent = Pick<
  Event,
  "state" | "remindersEnabled" | "startsAt" | "allDay" | "timeZone" | "publishedAt" | "weekReminderSentAt" | "dayReminderSentAt"
>;

// When a reminder falls due: so many days before the start. An all-day event starts at midnight in
// its zone, and its reminders do too, counted in days of its own calendar, so a clock change in
// between moves them by nothing.
function reminderTime(event: ReminderEvent, kind: ReminderKind): Date {
  const days = REMINDERS[kind].daysBefore;
  if (!event.allDay) return new Date(event.startsAt.getTime() - days * DAY);
  const [year, month, day] = toWallTime(event.startsAt, event.timeZone, { dateOnly: true }).split("-").map(Number);
  return toInstant(new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10), event.timeZone);
}

function sentAt(event: ReminderEvent, kind: ReminderKind): Date | null {
  return kind === "week" ? event.weekReminderSentAt : event.dayReminderSentAt;
}

// Which of an event's reminders are due now (spec, "Automatic reminders"): those of a published
// event with reminders on whose time has come, less than a day ago, after the host published it,
// and that have not been sent. A reminder more than a day late would say "in a week" or "tomorrow"
// when neither is true, so it is never sent; an outage shorter than a day still delivers. One whose
// time came before the event was published is never sent either, so an event published five days
// out sends no week reminder.
export function remindersDue(event: ReminderEvent, now: Date): ReminderKind[] {
  const { publishedAt } = event;
  if (event.state !== "published" || !event.remindersEnabled || !publishedAt) return [];
  return KINDS.filter((kind) => {
    const time = reminderTime(event, kind);
    return time <= now && now.getTime() < time.getTime() + DAY && publishedAt < time && sentAt(event, kind) === null;
  });
}
