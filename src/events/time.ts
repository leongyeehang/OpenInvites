// An event's time is an instant plus the event's IANA zone (spec, "Events"). Hosts type wall-clock
// times in that zone; guests see the event's zone. No date library: Intl has what is needed.

export type EventTime = { startsAt: Date; endsAt: Date | null; allDay: boolean; timeZone: string };

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

// When the event is over: its end, else its start; an all-day event lasts through its last day,
// until the next local midnight, so a clock change on that day does not shift it by an hour.
export function eventEnd(time: EventTime): Date {
  const last = time.endsAt ?? time.startsAt;
  if (!time.allDay) return last;
  const [year, month, day] = toWallTime(last, time.timeZone, { dateOnly: true }).split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return toInstant(nextDay, time.timeZone);
}

// The dashboard's two sections: what has not ended yet, soonest first, and what has, most recent first.
export function partitionByEnd<T extends EventTime>(events: T[], now: Date): { upcoming: T[]; past: T[] } {
  const byStart = (a: T, b: T) => a.startsAt.getTime() - b.startsAt.getTime();
  return {
    upcoming: events.filter((event) => eventEnd(event) >= now).sort(byStart),
    past: events.filter((event) => eventEnd(event) < now).sort((a, b) => byStart(b, a)),
  };
}
