import { eventEnd, type EventTime } from "../events/time";

// How long the instance keeps an event once it has ended (spec, "Retention"): a year unless the
// operator chooses otherwise on the instance settings page, from 30 days to ten years, or for ever.
// Its hosts are warned 30 days before, and nothing is deleted sooner than 30 days after they were.
export const DEFAULT_RETENTION_DAYS = 365;
export const RETENTION_MIN_DAYS = 30;
export const RETENTION_MAX_DAYS = 3650;
export const WARNING_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

// What deciding an event's fate needs of it: when it ends, and when its hosts were warned.
export type RetainedEvent = EventTime & { id: string; retentionWarnedAt: Date | null };

const daysAfter = (time: Date, days: number) => new Date(time.getTime() + days * DAY);

// Which events the clock's sweep marks and which it deletes, with the period as it is now (null:
// kept for ever). An event is marked, its hosts warned, once its end (eventEnd: an all-day event's
// is the end of its day) is the period less 30 days ago. A marked event is deleted once its end is
// the whole period ago and the mark is 30 days old, so a period lowered after the mark, or the
// first sweep on an instance with years of events behind it, deletes nothing for 30 days, and a
// period raised after the mark puts the deletion off. `floorDays` is how old the mark must be:
// 30 days, but for the test profile's instance without mail (retention/floor.ts).
export function retentionPlan(
  events: RetainedEvent[],
  now: Date,
  retentionDays: number | null,
  floorDays = WARNING_DAYS,
): { warn: string[]; remove: string[] } {
  if (retentionDays === null) return { warn: [], remove: [] };
  const passed = (time: Date) => time <= now;
  return {
    warn: events.filter((event) => event.retentionWarnedAt === null && passed(daysAfter(eventEnd(event), retentionDays - WARNING_DAYS))).map(({ id }) => id),
    remove: events
      .filter(
        (event) =>
          event.retentionWarnedAt !== null && passed(daysAfter(event.retentionWarnedAt, floorDays)) && passed(daysAfter(eventEnd(event), retentionDays)),
      )
      .map(({ id }) => id),
  };
}

// The day a marked event will be deleted, as its manage page, the dashboard and the warning say:
// the later of 30 days after the mark and the end plus the period. None before the mark, or while
// the instance keeps events for ever.
export function deletionDate(event: Omit<RetainedEvent, "id">, retentionDays: number | null, floorDays = WARNING_DAYS): Date | undefined {
  if (event.retentionWarnedAt === null || retentionDays === null) return undefined;
  const afterWarning = daysAfter(event.retentionWarnedAt, floorDays);
  const afterPeriod = daysAfter(eventEnd(event), retentionDays);
  return afterWarning > afterPeriod ? afterWarning : afterPeriod;
}

// The marks a newly saved period no longer bears out, which saving it takes off (spec,
// "Retention"): every mark with Keep forever, and with a period, those of events whose end plus the
// period less 30 days is still ahead. Should the period bring such an event back, its hosts are
// warned afresh and have their 30 days again. A shorter period takes off nothing.
export function staleMarks(events: RetainedEvent[], now: Date, retentionDays: number | null): string[] {
  return events
    .filter((event) => event.retentionWarnedAt !== null && (retentionDays === null || daysAfter(eventEnd(event), retentionDays - WARNING_DAYS) > now))
    .map(({ id }) => id);
}
