import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireHost } from "@/auth/session";
import { Button } from "@/components/ui/button";
import { listHostEvents, type Event } from "@/events/repository";
import { formatWhen, partitionByEnd } from "@/events/time";
import { NO_RSVPS, type RsvpCounts } from "@/rsvps/counts";
import { countRsvpsByEvent } from "@/rsvps/repository";
import { EventStateBadge } from "../events/event-state-badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Host.dashboard");
  return { title: t("title") };
}

// Upcoming and past, decided by when the event ends, each card carrying how its RSVPs stand.
export default async function DashboardPage() {
  const host = await requireHost();
  const [t, locale, events] = await Promise.all([
    getTranslations("Host.dashboard"),
    getLocale(),
    listHostEvents(host.id),
  ]);
  const { upcoming, past } = partitionByEnd(events, new Date());
  const counts = await countRsvpsByEvent(events.map((event) => event.id));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button asChild>
          <Link href="/events/new">{t("new")}</Link>
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <EventList id="upcoming" heading={t("upcoming")} events={upcoming} empty={t("emptyUpcoming")} locale={locale} counts={counts} />
          <EventList id="past" heading={t("past")} events={past} empty={t("emptyPast")} locale={locale} counts={counts} />
        </>
      )}
    </>
  );
}

async function EventList({
  id,
  heading,
  events,
  empty,
  locale,
  counts,
}: {
  id: string;
  heading: string;
  events: Event[];
  empty: string;
  locale: string;
  counts: Map<string, RsvpCounts>;
}) {
  const t = await getTranslations("Host.dashboard");
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-lg font-medium">
        {heading}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const replies = counts.get(event.id) ?? NO_RSVPS;
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.title}</span>
                    <EventStateBadge state={event.state} />
                  </div>
                  <span className="text-sm text-muted-foreground">{formatWhen(event, locale)}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("counts", { going: replies.going, maybe: replies.maybe, declined: replies.cant })}
                    {` · ${t("headcount", { count: replies.headcount })}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
