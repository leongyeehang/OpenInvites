"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useClock } from "@/events/use-clock";
import type { EventTime } from "@/events/time";
import { cn } from "@/lib/utils";
import { liveWindow, scheduleDays, scheduleInstants, scheduleStates, shouldRefresh } from "@/schedule/clock";
import type { ScheduleItem, ScheduleRefresh } from "@/schedule/schedule";

// What the event page hands the schedule (app/e/[slug]/page.tsx): the items in order, each with
// its time as written, the day headings by day, how the page keeps fresh, the event's time alone,
// and the server's time, which the page is first drawn by. The times and days are written on the
// server, since they never change with the clock and the browser's Intl may space them otherwise
// (Chrome puts plain spaces in "7:00 – 9:00 PM" where Node puts thin and narrow no-break ones).
export type ShownScheduleItem = ScheduleItem & { when: string };
export type ScheduleShown = { items: ShownScheduleItem[]; headings: Record<string, string>; refresh: ScheduleRefresh; time: EventTime; now: Date };

const MINUTE = 60_000;

const NOTHING_TO_SUBSCRIBE_TO = () => () => {};

// The device's own zone, as nothing on the server and in the first client render, so the two agree.
function useDeviceZone(): string | null {
  return useSyncExternalStore(
    NOTHING_TO_SUBSCRIBE_TO,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

// Under `minute`, while the schedule is live, the page re-reads itself every minute its tab is
// visible, and on coming back to the tab when it last did so over a minute ago, so the host's
// changes reach it (M6 spec, "The schedule"). Before the window opens the minute passes idly; once
// it has closed, the loop stops. Under `reload`, nothing runs. `router.refresh()` draws the page
// again on the server and keeps what is open on it.
function useRefreshWhileLive(refresh: ScheduleRefresh, from: number, to: number) {
  const router = useRouter();
  useEffect(() => {
    if (refresh !== "minute" || Date.now() >= to) return;
    const live = { from: new Date(from), to: new Date(to) };
    let last = Date.now();
    const refreshIf = (due: boolean) => {
      const now = new Date();
      if (due && shouldRefresh({ refresh, now, window: live, visible: document.visibilityState === "visible" })) {
        last = now.getTime();
        router.refresh();
      }
    };
    const everyMinute = setInterval(() => {
      if (Date.now() >= to) clearInterval(everyMinute);
      else refreshIf(true);
    }, MINUTE);
    const onReturn = () => refreshIf(Date.now() - last >= MINUTE);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      clearInterval(everyMinute);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh, from, to, router]);
}

// The schedule (M6 spec, "The schedule"): the items in the event's zone, under their days when
// they span more than one, each past, now or upcoming by the guest's clock. The page is drawn by
// the server's time, then follows the device's every half minute. The layout frames it and gives
// it its heading.
export function ScheduleSection({ items, headings, refresh, time, now: serverNow }: ScheduleShown) {
  const t = useTranslations("EventPage.schedule");
  const now = useClock(serverNow);
  const zone = useDeviceZone();

  const instants = scheduleInstants(items, time.timeZone);
  const states = scheduleStates(instants, time, now);
  const live = liveWindow(instants, time);
  useRefreshWhileLive(refresh, live.from.getTime(), live.to.getTime());

  const days = scheduleDays(items.map((item, index) => ({ ...item, ...instants[index], state: states[index] })));

  return (
    <>
      {zone && zone !== time.timeZone && <p className="mb-3 text-sm text-theme-text-muted">{t("inZone", { zone: time.timeZone })}</p>}
      <div className="flex flex-col gap-5">
        {days.map((day) => (
          <div key={day.day}>
            {days.length > 1 && <h3 className="mb-2 font-medium">{headings[day.day]}</h3>}
            <ol className="flex flex-col gap-1">
              {day.items.map((item) => (
                <li
                  key={item.id}
                  data-state={item.state}
                  aria-current={item.state === "now" ? "true" : undefined}
                  // The theme's muted text is never fainter than 75% of the text (legibility.ts), so
                  // a past item stays readable; no opacity is laid over it, which would take it
                  // under. A change of state fades in, and nothing pulses.
                  className={cn(
                    "-mx-3 rounded-2xl px-3 py-2.5 motion-safe:transition-colors",
                    item.state === "now" && "bg-theme-glass-strong ring-2 ring-theme-accent",
                    item.state === "past" && "text-theme-text-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <time dateTime={item.start.toISOString()} className="text-sm tabular-nums">
                      {item.when}
                    </time>
                    {item.state === "now" && (
                      <span className="shrink-0 rounded-full bg-theme-accent px-2.5 py-0.5 text-xs font-medium text-theme-on-accent">{t("now")}</span>
                    )}
                  </div>
                  <p className="mt-0.5 font-medium break-words">
                    {item.title}
                    {item.state === "past" && <span className="sr-only"> {t("ended")}</span>}
                  </p>
                  {item.place && <p className="text-sm break-words text-theme-text-muted">{item.place}</p>}
                  {item.note && <p className="mt-1 text-sm break-words whitespace-pre-wrap text-theme-text-muted">{item.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
