"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { countdownFor } from "@/events/countdown";
import { mapHref } from "@/events/map";
import type { EventTime } from "@/events/time";

// Three things only the guest's own device knows: what time it is, what zone they are in, and
// which maps app they have. Each reads as nothing on the server and in the first client render,
// so the two agree, and fills in once the browser has answered.

const NOTHING_TO_SUBSCRIBE_TO = () => () => {};

function useOnTheDevice(): boolean {
  return useSyncExternalStore(
    NOTHING_TO_SUBSCRIBE_TO,
    () => true,
    () => false,
  );
}

// The clock, in half-minute steps so the snapshot holds still between ticks and a countdown in
// minutes stays honest.
const TICK_MS = 30_000;

function subscribeToClock(onChange: () => void) {
  const tick = setInterval(onChange, TICK_MS);
  return () => clearInterval(tick);
}

function useClock(): Date | null {
  const tick = useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / TICK_MS),
    () => null,
  );
  return tick === null ? null : new Date(tick * TICK_MS);
}

export function Countdown({ event }: { event: EventTime }) {
  const t = useTranslations("EventPage");
  const now = useClock();
  if (!now) return null;

  const countdown = countdownFor(event, now);
  const says =
    countdown.state === "now"
      ? t("happeningNow")
      : countdown.state === "ended"
        ? t("ended")
        : countdown.days > 0
          ? t("startsInDays", { count: countdown.days })
          : countdown.hours > 0
            ? t("startsInHours", { count: countdown.hours })
            : t("startsInMinutes", { count: countdown.minutes });

  return (
    <p className="mt-3 inline-flex rounded-full bg-theme-accent px-3 py-1 text-sm font-medium text-theme-on-accent">{says}</p>
  );
}

// The same moment on the guest's own clock, when that is not the event's clock.
export function ViewerTime({ event, locale }: { event: EventTime; locale: string }) {
  const t = useTranslations("EventPage");
  if (!useOnTheDevice() || event.allDay) return null;

  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!here || here === event.timeZone) return null;

  const time = new Intl.DateTimeFormat(locale, {
    timeZone: here,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(event.startsAt);
  return <p className="mt-1 text-sm text-theme-text-muted">{t("yourTime", { time })}</p>;
}

export function MapLink({ location }: { location: string }) {
  const t = useTranslations("EventPage");
  if (!useOnTheDevice()) return null;

  const apple = /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);
  return (
    <a
      href={mapHref(location, { apple })}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium underline decoration-theme-accent underline-offset-4 hover:opacity-80"
    >
      {t("openInMaps")} <ArrowUpRight className="size-4" aria-hidden />
    </a>
  );
}
