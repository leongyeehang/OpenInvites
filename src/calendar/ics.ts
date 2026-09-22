import { basicDateIn, detailsOf, utcStamp, type CalendarEvent } from "./calendar";

// RFC 5545 reserves these inside a value.
function escaped(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// No line may run past 75 octets; the rest continues on the next one after a single space.
function folded(line: string): string[] {
  const octets = [...new TextEncoder().encode(line)];
  if (octets.length <= 75) return [line];

  const decoder = new TextDecoder();
  const parts: string[] = [];
  let at = 0;
  while (at < octets.length) {
    // The first line takes 75, each continuation 74, because the space counts.
    const take = parts.length === 0 ? 75 : 74;
    let end = Math.min(at + take, octets.length);
    // Never split a character in half.
    while (end > at && end < octets.length && (octets[end] & 0xc0) === 0x80) end -= 1;
    parts.push((parts.length === 0 ? "" : " ") + decoder.decode(new Uint8Array(octets.slice(at, end))));
    at = end;
  }
  return parts;
}

// The event as a calendar file (spec, "Calendar"): a stable identifier, the times, the title,
// the place, the description, and the link back to the invitation.
export function buildIcs(event: CalendarEvent, link: string, now: Date): string {
  const when = event.allDay
    ? [
        `DTSTART;VALUE=DATE:${basicDateIn(event.startsAt, event.timeZone)}`,
        // An all-day entry ends the day after its last, which is how calendars read it.
        `DTEND;VALUE=DATE:${basicDateIn(event.endsAt ?? event.startsAt, event.timeZone, 1)}`,
      ]
    : [`DTSTART:${utcStamp(event.startsAt)}`, ...(event.endsAt ? [`DTEND:${utcStamp(event.endsAt)}`] : [])];

  const description = detailsOf(event, link);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenInvites//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@openinvites`,
    `DTSTAMP:${utcStamp(now)}`,
    ...when,
    `SUMMARY:${escaped(event.title)}`,
    ...(event.location ? [`LOCATION:${escaped(event.location)}`] : []),
    `DESCRIPTION:${escaped(description)}`,
    `URL:${link}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.flatMap(folded).join("\r\n")}\r\n`;
}
