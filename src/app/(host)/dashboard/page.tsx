import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireHost } from "@/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventsOwnedAtLimit } from "@/events/limit";
import { listHostEvents, type HostEvent } from "@/events/repository";
import { formatDay, formatWhen, isDated, partitionByEnd } from "@/events/time";
import type { Limits } from "@/instance/limits";
import { pickPoster, posterPool } from "@/instance/home";
import { homePage, instanceLimits, operatorToWelcome, registrationMode } from "@/instance/repository";
import { ClientMessages } from "@/locale/client-messages";
import { retentionFloorDays } from "@/retention/floor";
import { deletionDate } from "@/retention/plan";
import { NO_RSVPS, type RsvpCounts } from "@/rsvps/counts";
import { countRsvpsByEvent } from "@/rsvps/repository";
import { findGalleryPoster } from "@/themes/posters";
import { EventStateBadge } from "../events/event-state-badge";
import { OperatorWelcome } from "./operator-welcome";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Host.dashboard");
  return { title: t("title") };
}

// Upcoming and past, decided by when the event ends, each card carrying how its RSVPs stand, and
// the day it will be deleted once it is marked for its age (spec, "Retention"). The events the host
// co-hosts are among them, marked so. A new operator is first welcomed on it, once.
export default async function DashboardPage() {
  const host = await requireHost();
  const [t, locale, events, limits, welcome] = await Promise.all([
    getTranslations("Host.dashboard"),
    getLocale(),
    listHostEvents(host.id),
    instanceLimits(),
    operatorToWelcome(host.id),
  ]);
  const { retentionDays } = limits;
  const { upcoming, past } = partitionByEnd(events, new Date());
  const [counts, atLimit] = await Promise.all([countRsvpsByEvent(events.map((event) => event.id)), eventsOwnedAtLimit(host.id)]);

  return (
    <>
      {welcome && <Welcome limits={limits} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {t("title")}
        </h1>
        {atLimit === undefined ? (
          <Button asChild>
            <Link href="/events/new">{t("new")}</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("limitReached", { count: atLimit })}</p>
        )}
      </div>
      {events.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <EventList id="upcoming" heading={t("upcoming")} events={upcoming} empty={t("emptyUpcoming")} locale={locale} counts={counts} retentionDays={retentionDays} />
          <EventList id="past" heading={t("past")} events={past} empty={t("emptyPast")} locale={locale} counts={counts} retentionDays={retentionDays} />
        </>
      )}
    </>
  );
}

async function Welcome({ limits }: { limits: Limits }) {
  const [home, mode] = await Promise.all([homePage(), registrationMode()]);
  return (
    <ClientMessages namespaces={["Dashboard.operatorWelcome"]}>
      <OperatorWelcome
        poster={findGalleryPoster(pickPoster(posterPool(home)))!.card}
        instanceName={home.instanceName}
        mode={mode}
        maxEventsPerHost={limits.maxEventsPerHost}
        retentionDays={limits.retentionDays}
      />
    </ClientMessages>
  );
}

async function EventList({
  id,
  heading,
  events,
  empty,
  locale,
  counts,
  retentionDays,
}: {
  id: string;
  heading: string;
  events: HostEvent[];
  empty: string;
  locale: string;
  counts: Map<string, RsvpCounts>;
  retentionDays: number | null;
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
            const deletion = deletionDate(event, retentionDays, retentionFloorDays());
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.title || t("untitled")}</span>
                    <EventStateBadge state={event.state} />
                    {event.role === "coHost" && <Badge variant="outline">{t("coHost")}</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground">{isDated(event) ? formatWhen(event, locale) : t("noDate")}</span>
                  {deletion && <span className="text-sm font-medium">{t("deletedOn", { date: formatDay(deletion, event.timeZone, locale) })}</span>}
                  <span className="text-sm text-muted-foreground">
                    {t("counts", { going: replies.going, maybe: replies.maybe, declined: replies.cant })}
                    {replies.waitlisted > 0 && ` · ${t("waitlisted", { count: replies.waitlisted })}`}
                    {replies.pending > 0 && ` · ${t("pending", { count: replies.pending })}`}
                    {` · ${
                      event.capacity === null
                        ? t("headcount", { count: replies.headcount })
                        : t("headcountOf", { count: replies.headcount, capacity: event.capacity })
                    }`}
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
