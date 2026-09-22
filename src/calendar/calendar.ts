import { toWallTime } from "@/events/time";

// What a calendar entry needs from an event.
export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  timeZone: string;
  location: string;
  description: string;
};

// An instant, written the one way every calendar reads the same: UTC (ADR-0006).
export function utcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

// An all-day event's dates belong to the event's own zone: the tenth is the tenth there.
export function dateIn(instant: Date, timeZone: string, addDays = 0): string {
  const [year, month, day] = toWallTime(instant, timeZone, { dateOnly: true }).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + addDays)).toISOString().slice(0, 10);
}

// The same date without its dashes, which is the form both iCalendar and Google want.
export function basicDateIn(instant: Date, timeZone: string, addDays = 0): string {
  return dateIn(instant, timeZone, addDays).replace(/-/g, "");
}

// What the entry says, which is the host's description and the way back to the invitation.
export function detailsOf(event: CalendarEvent, link: string): string {
  return [event.description, link].filter(Boolean).join("\n\n");
}
