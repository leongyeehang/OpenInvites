import { eventEnd, type EventTime } from "./time";

// How far off the event is, for the line that makes the date feel real (spec, story 59). The
// page recomputes it on a timer, so it never goes stale while a guest reads.
export type Countdown =
  | { state: "before"; days: number; hours: number; minutes: number }
  | { state: "now" }
  | { state: "ended" };

const MINUTE = 60_000;

export function countdownFor(event: EventTime, now: Date): Countdown {
  const until = event.startsAt.getTime() - now.getTime();
  if (until > 0) {
    const minutes = Math.floor(until / MINUTE);
    return { state: "before", days: Math.floor(minutes / 1440), hours: Math.floor(minutes / 60) % 24, minutes: minutes % 60 };
  }
  return now < eventEnd(event) ? { state: "now" } : { state: "ended" };
}
