// An event's time is an instant plus the event's IANA zone (spec, "Events"). Hosts type wall-clock
// times in that zone; guests see the event's zone. No date library: Intl has what is needed.

export type EventTime = { startsAt: Date; endsAt: Date | null; allDay: boolean; timeZone: string };

// A draft may not be dated yet (M4 spec, "A draft with no date"); everything published is.
export type MaybeDated<T extends { startsAt: Date | null }> = Omit<T, "startsAt"> & { startsAt: Date | null };
export type Dated<T extends { startsAt: Date | null }> = Omit<T, "startsAt"> & { startsAt: Date };

export function isDated<T extends { startsAt: Date | null }>(event: T): event is T & { startsAt: Date } {
  return event.startsAt !== null;
}

// Anything Intl can format in, which includes aliases browsers report (Asia/Kolkata) that
// supportedValuesOf leaves out (it lists Asia/Calcutta).
export function isTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// The choices offered in the form: every zone Node lists, plus UTC, which the list omits.
export function timeZones(): string[] {
  return ["UTC", ...Intl.supportedValuesOf("timeZone")];
}

// Zone offset (wall clock minus UTC) at an instant, in milliseconds.
function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

// "2026-10-03T19:00" or "2026-10-03" as typed into a date input, read in the event's zone.
export function toInstant(wall: string, timeZone: string): Date {
  const [date, time = "00:00"] = wall.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The zone's offset depends on the instant, so guess, then correct once for a DST edge.
  let instant = asUtc - offsetAt(new Date(asUtc), timeZone);
  instant = asUtc - offsetAt(new Date(instant), timeZone);
  return new Date(instant);
}

// The inverse, for filling a date input when editing.
export function toWallTime(instant: Date, timeZone: string, options: { dateOnly?: boolean } = {}): string {
  const wall = new Date(instant.getTime() + offsetAt(instant, timeZone)).toISOString();
  return options.dateOnly ? wall.slice(0, 10) : wall.slice(0, 16);
}

// When the event happens, in its own zone, in the viewer's language.
export function formatWhen(time: EventTime, locale: string): string {
  if (time.allDay) {
    const dates = new Intl.DateTimeFormat(locale, { timeZone: time.timeZone, dateStyle: "full" });
    return time.endsAt ? dates.formatRange(time.startsAt, time.endsAt) : dates.format(time.startsAt);
  }
  const times = new Intl.DateTimeFormat(locale, {
    timeZone: time.timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return time.endsAt ? times.formatRange(time.startsAt, time.endsAt) : times.format(time.startsAt);
}

// The date under the poster's title (M4 spec, "The guest page"): the start's day, short, and its
// time, in the event's zone; an all-day event's days alone. The When row gives it in full.
// Given `year`, the day carries its year too: the dashboard's tiles, for an event in another year.
export function formatWhenBrief(time: EventTime, locale: string, { year = false }: { year?: boolean } = {}): string {
  const day = new Intl.DateTimeFormat(locale, { timeZone: time.timeZone, weekday: "short", month: "short", day: "numeric", year: year ? "numeric" : undefined });
  if (time.allDay) return time.endsAt ? day.formatRange(time.startsAt, time.endsAt) : day.format(time.startsAt);
  const clock = new Intl.DateTimeFormat(locale, { timeZone: time.timeZone, hour: "numeric", minute: "2-digit" });
  return `${day.format(time.startsAt)} · ${clock.format(time.startsAt)}`;
}

// When the event is over: its end, else its start; an all-day event lasts through its last day,
// until the next local midnight, so a clock change on that day does not shift it by an hour.
export function eventEnd(time: EventTime): Date {
  const last = time.endsAt ?? time.startsAt;
  if (!time.allDay) return last;
  const [year, month, day] = toWallTime(last, time.timeZone, { dateOnly: true }).split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return toInstant(nextDay, time.timeZone);
}

// The dashboard's two sections: what has not ended yet, soonest first, and what has, most recent
// first. A draft with no date yet has not ended, and comes after every dated event.
export function partitionByEnd<T extends Omit<EventTime, "startsAt"> & { startsAt: Date | null }>(events: T[], now: Date): { upcoming: T[]; past: T[] } {
  const at = (event: T) => event.startsAt?.getTime() ?? Infinity;
  const ended = (event: T) => isDated(event) && eventEnd(event) < now;
  return {
    upcoming: events.filter((event) => !ended(event)).sort((a, b) => at(a) - at(b)),
    past: events.filter(ended).sort((a, b) => at(b) - at(a)),
  };
}

// A day the host is told of, such as the day an event will be deleted for its age (spec,
// "Retention"), in the event's own zone, as every time on the host's pages is: "November 12, 2026".
export function formatDay(instant: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "long" }).format(instant);
}

// A moment on the host's guest list, shown in the event's own zone so every time on the page
// belongs to the same clock: "3 Oct, 19:04".
export function formatMoment(instant: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}
