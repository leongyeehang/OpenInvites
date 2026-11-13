import type { EventWithHost } from "@/events/repository";
import { isDated } from "@/events/time";
import { scheduleInstants } from "@/schedule/clock";
import { listSchedule } from "@/schedule/repository";
import type { SectionDrawing } from "@/sections";
import type { SectionPage } from "./drawings";
import { ScheduleSection, type ScheduleShown } from "./schedule-section";

// The schedule's drawing (M8 ticket 25), apart from schedule-section.tsx, which runs in the browser.

// The schedule (M6 ticket 02), or nothing when the host has listed none, the event has no date
// to follow, or it is cancelled: the notice that it is off takes the day's plan's place, and a
// cancelled day is not worth re-reading every minute. A client component is sent all it is
// handed, so only plain fields: the items, each with its time written in the event's zone, the day
// headings, how guests' pages keep fresh, the event's time alone, and the time the page is drawn
// at, which the browser's first drawing must agree with. The times and days are written here,
// once, so the browser shows the server's words.
export async function scheduleFor(event: EventWithHost, now: Date, locale: string): Promise<ScheduleShown | undefined> {
  if (!isDated(event) || event.state === "cancelled") return undefined;
  const items = await listSchedule(event.id);
  if (items.length === 0) return undefined;
  const { startsAt, endsAt, allDay, timeZone } = event;
  const instants = scheduleInstants(items, timeZone);
  const clock = new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" });
  const days = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" });
  return {
    items: items.map((item, index) => {
      const { start, end } = instants[index];
      return { ...item, when: end ? clock.formatRange(start, end) : clock.format(start) };
    }),
    headings: Object.fromEntries(items.map((item, index) => [item.day, days.format(instants[index].start)])),
    refresh: event.scheduleRefresh,
    time: { startsAt, endsAt, allDay, timeZone },
    now,
  };
}

export const scheduleDrawing: SectionDrawing<ScheduleShown, SectionPage> = {
  load: ({ event, now, locale }) => scheduleFor(event, now, locale),
  shown: (schedule) => ({ count: schedule.items.length }),
  body: (schedule) => <ScheduleSection {...schedule} />,
};
