import { fieldTime, isDay, TIME } from "../polls/poll";

// The schedule (M6 spec, "The schedule"): the host's list of timed items for the event's day or
// days, each a day and a start time in the event's zone, kept as wall-clock time as date options
// are, with an optional end, place and note. Saved as a whole from the editor's sheet and kept in
// day-and-time order: there is no reordering by hand.

// How guests' open pages pick up a changed schedule: by re-reading themselves every minute while
// the event is on, or only when they are opened.
export const SCHEDULE_REFRESH = ["minute", "reload"] as const;
export type ScheduleRefresh = (typeof SCHEDULE_REFRESH)[number];

export const MAX_ITEMS = 50;
export const MAX_TITLE = 80;
export const MAX_PLACE = 120;
export const MAX_NOTE = 500;

// An item as the host types it into the sheet: a day ("2027-05-08"), a start and an end time on it
// ("19:00"), a title, a place and a note, each as typed.
export type ScheduleItemInput = { day: string; startTime: string; endTime: string; title: string; place: string; note: string };

// An item as kept.
export type ScheduleItem = { id: string; day: string; startTime: string; endTime: string | null; title: string; place: string; note: string };

// An item once trusted, with the position its order gives it.
export type ScheduleEntry = Omit<ScheduleItem, "id"> & { position: number };

export type ScheduleError =
  | "scheduleTooMany"
  | "scheduleDayInvalid"
  | "scheduleTimeRequired"
  | "scheduleTimeInvalid"
  | "scheduleEndBeforeStart"
  | "scheduleTitleRequired"
  | "scheduleTitleTooLong"
  | "schedulePlaceTooLong"
  | "scheduleNoteTooLong"
  | "scheduleInvalid";

// A refusal names the row it is about, counted as the host sees the sheet's rows, from 1.
export type ParsedSchedule = { ok: true; items: ScheduleEntry[] } | { ok: false; error: ScheduleError; n?: number };

const FIELDS = ["day", "startTime", "endTime", "title", "place", "note"] as const;

// Reads a row the sheet posted, field by field, so a crafted post is a refusal rather than a
// crash (the same stance the questions editor takes). A field left out is blank.
function asInput(value: unknown): ScheduleItemInput | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const input = {} as ScheduleItemInput;
  for (const field of FIELDS) {
    const posted = raw[field] ?? "";
    if (typeof posted !== "string") return undefined;
    input[field] = posted.trim();
  }
  return input;
}

// Day by day, then by start time, both compared as the fixed-width text they are; items at one
// time keep the order they came in, since the sort is stable.
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function sortSchedule<T extends { day: string; startTime: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compare(a.day, b.day) || compare(a.startTime, b.startTime));
}

// The rules of the schedule's sheet: rows left wholly blank are left out, then up to fifty items,
// each a real day, a start time, an end only later than the start, and a title, within their
// lengths. The items are then put in day-and-time order, which is their position.
export function parseSchedule(posted: unknown): ParsedSchedule {
  if (!Array.isArray(posted)) return { ok: false, error: "scheduleInvalid" };
  const rows: { input: ScheduleItemInput; n: number }[] = [];
  for (const [index, posting] of posted.entries()) {
    const input = asInput(posting);
    if (!input) return { ok: false, error: "scheduleInvalid", n: index + 1 };
    if (FIELDS.some((field) => input[field])) rows.push({ input, n: index + 1 });
  }
  if (rows.length > MAX_ITEMS) return { ok: false, error: "scheduleTooMany" };

  const items: Omit<ScheduleEntry, "position">[] = [];
  for (const { input, n } of rows) {
    const refuse = (error: ScheduleError): ParsedSchedule => ({ ok: false, error, n });
    // A time field gives seconds when asked to; the schedule keeps minutes, as the poll does, and
    // the whole time is checked, so nothing after it slips through (polls/poll.ts, fieldTime).
    const startTime = fieldTime(input.startTime);
    const endTime = fieldTime(input.endTime);
    if (!isDay(input.day)) return refuse("scheduleDayInvalid");
    if (!startTime) return refuse("scheduleTimeRequired");
    if (!TIME.test(startTime) || (endTime && !TIME.test(endTime))) return refuse("scheduleTimeInvalid");
    if (endTime && endTime <= startTime) return refuse("scheduleEndBeforeStart");
    if (!input.title) return refuse("scheduleTitleRequired");
    if (input.title.length > MAX_TITLE) return refuse("scheduleTitleTooLong");
    if (input.place.length > MAX_PLACE) return refuse("schedulePlaceTooLong");
    if (input.note.length > MAX_NOTE) return refuse("scheduleNoteTooLong");
    items.push({ day: input.day, startTime, endTime: endTime || null, title: input.title, place: input.place, note: input.note });
  }
  return { ok: true, items: sortSchedule(items).map((item, position) => ({ ...item, position })) };
}

export function parseScheduleRefresh(value: unknown): ScheduleRefresh | undefined {
  return SCHEDULE_REFRESH.find((each) => each === value);
}
