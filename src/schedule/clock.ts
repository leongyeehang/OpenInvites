import { eventEnd, toInstant, type EventTime } from "@/events/time";
import type { ScheduleItem, ScheduleRefresh } from "./schedule";

// The schedule by the guest's clock (M6 spec, "The schedule"): which item is on now, which are
// past and which are still to come, and when a guest's open page re-reads itself to pick up the
// host's changes. Pure, so the server's first drawing and the browser's ticks follow one rule.

export type ScheduleInstant = { start: Date; end: Date | null };
export type ScheduleState = "past" | "now" | "upcoming";

// Each item's start and end as instants, its wall-clock times read in the event's zone.
export function scheduleInstants(items: Pick<ScheduleItem, "day" | "startTime" | "endTime">[], timeZone: string): ScheduleInstant[] {
  return items.map(({ day, startTime, endTime }) => ({
    start: toInstant(`${day}T${startTime}`, timeZone),
    end: endTime ? toInstant(`${day}T${endTime}`, timeZone) : null,
  }));
}

// When the schedule is over: the event's end (time.ts), except for an event with a start and no
// end, which time.ts ends at its start: for the schedule, that one finishes at the next midnight
// in the event's zone after its last item's day, or at its start if that is later (M6 ticket 02,
// a controller's ruling). That midnight is the end time.ts gives an all-day event on that day.
export function scheduleFinish(instants: ScheduleInstant[], event: EventTime): Date {
  if (event.endsAt || event.allDay || instants.length === 0) return eventEnd(event);
  const lastStart = new Date(Math.max(...instants.map(({ start }) => start.getTime())));
  const midnight = eventEnd({ startsAt: lastStart, endsAt: null, allDay: true, timeZone: event.timeZone });
  return midnight > event.startsAt ? midnight : event.startsAt;
}

// An item is now from its start until its end, or until the next item starts, or, with neither,
// until the schedule is over (scheduleFinish); past after that, and upcoming before. The next item
// is the first that starts strictly later, so two items at one time are both now. Once the
// schedule is over, every item is past.
export function scheduleStates(instants: ScheduleInstant[], event: EventTime, now: Date): ScheduleState[] {
  const finish = scheduleFinish(instants, event);
  if (now >= finish) return instants.map(() => "past");
  return instants.map(({ start, end }) => {
    if (now < start) return "upcoming";
    const later = instants.filter((other) => other.start > start).map((other) => other.start.getTime());
    const nextStart = later.length > 0 ? Math.min(...later) : finish.getTime();
    const until = Math.min(end?.getTime() ?? finish.getTime(), nextStart);
    return now.getTime() < until ? "now" : "past";
  });
}

// The items under their days, in order. A single group is a one-day schedule, which needs no day
// headings.
export function scheduleDays<T extends { day: string }>(items: T[]): { day: string; items: T[] }[] {
  const days: { day: string; items: T[] }[] = [];
  for (const each of items) {
    const group = days.find((day) => day.day === each.day);
    if (group) group.items.push(each);
    else days.push({ day: each.day, items: [each] });
  }
  return days;
}

// While the schedule is live, and so worth re-reading: from the earlier of the event's start and
// the first item's, until the schedule is over.
export type LiveWindow = { from: Date; to: Date };

export function liveWindow(instants: ScheduleInstant[], event: EventTime): LiveWindow {
  const from = Math.min(event.startsAt.getTime(), ...instants.map(({ start }) => start.getTime()));
  return { from: new Date(from), to: scheduleFinish(instants, event) };
}

// Whether an open page re-reads itself now: under `minute`, inside the live window, and only while
// its tab is visible; under `reload`, never.
export function shouldRefresh({ refresh, now, window, visible }: { refresh: ScheduleRefresh; now: Date; window: LiveWindow; visible: boolean }): boolean {
  return refresh === "minute" && visible && now >= window.from && now < window.to;
}
