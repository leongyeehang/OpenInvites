import type { PollOption } from "./poll";

// A candidate as people read it, in their language: its day, and its times if it has them. The
// day and times are the event's wall clock as the host typed them, so they are written as given,
// whatever zone the reader is in (formatted as UTC, which leaves them as they are).
export function formatOption(option: Pick<PollOption, "day" | "startTime" | "endTime">, locale: string): string {
  const day = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${option.day}T12:00:00Z`),
  );
  if (!option.startTime) return day;
  const time = new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
  const at = (wall: string) => new Date(`${option.day}T${wall.slice(0, 5)}:00Z`);
  const times = option.endTime ? time.formatRange(at(option.startTime), at(option.endTime)) : time.format(at(option.startTime));
  return `${day} · ${times}`;
}
