import { isTimeZone, toInstant, toWallTime } from "./time";

// What a host fills in, once trusted. Times are instants; the form's wall-clock values are
// converted with the event's zone below.
export type EventInput = {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  timeZone: string;
  location: string;
  description: string;
};

// What the event form posts, as strings, before any of it is trusted.
export type EventFormFields = {
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  timeZone: string;
  location: string;
  description: string;
};

export type EventFormError =
  | "titleRequired"
  | "startRequired"
  | "startInvalid"
  | "endInvalid"
  | "endBeforeStart"
  | "timeZoneInvalid";

export type ParsedEventForm = { ok: true; input: EventInput } | { ok: false; error: EventFormError };

const WALL_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

function parseWall(value: string, allDay: boolean, timeZone: string): Date | undefined {
  if (!WALL_TIME.test(value)) return undefined;
  // An all-day event keeps only the date, whatever the input sent.
  const wall = allDay ? value.slice(0, 10) : value;
  const instant = toInstant(wall, timeZone);
  // Round-tripping catches what the pattern cannot: 30 February, 24:30, or a time the clocks skip.
  if (Number.isNaN(instant.getTime()) || toWallTime(instant, timeZone, { dateOnly: allDay }) !== wall) return undefined;
  return instant;
}

// The rules of the event form (ticket 05): a title, a start, an end after the start, a real zone.
export function parseEventForm(fields: EventFormFields): ParsedEventForm {
  const title = fields.title.trim();
  if (!title) return { ok: false, error: "titleRequired" };
  if (!isTimeZone(fields.timeZone)) return { ok: false, error: "timeZoneInvalid" };
  if (!fields.start) return { ok: false, error: "startRequired" };

  const startsAt = parseWall(fields.start, fields.allDay, fields.timeZone);
  if (!startsAt) return { ok: false, error: "startInvalid" };

  let endsAt: Date | null = null;
  if (fields.end) {
    const end = parseWall(fields.end, fields.allDay, fields.timeZone);
    if (!end) return { ok: false, error: "endInvalid" };
    // A one-day all-day event needs no end; otherwise the end must come after the start.
    if (fields.allDay && end.getTime() === startsAt.getTime()) endsAt = null;
    else if (end <= startsAt) return { ok: false, error: "endBeforeStart" };
    else endsAt = end;
  }

  return {
    ok: true,
    input: {
      title,
      allDay: fields.allDay,
      startsAt,
      endsAt,
      timeZone: fields.timeZone,
      location: fields.location.trim(),
      description: fields.description.trim(),
    },
  };
}
