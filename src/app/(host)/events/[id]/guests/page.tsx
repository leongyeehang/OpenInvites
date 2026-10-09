import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { formatMoment } from "@/events/time";
import { ClientMessages } from "@/locale/client-messages";
import { listAnswersByGuest } from "@/questions/repository";
import { asTally, countRsvps, groupByStatus } from "@/rsvps/counts";
import { listGuestList } from "@/rsvps/repository";
import { GuestRow } from "./guest-row";
import { RefreshWhileWatching } from "./refresh-every";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Guests");
  return { title: t("title") };
}

// Everyone who has answered, grouped the way the RSVP buttons are ordered, with the headcount
// the host is really after. The list refreshes itself while the host watches.
export default async function GuestListPage({ params }: PageProps<"/events/[id]/guests">) {
  const [host, { id }, t, locale] = await Promise.all([
    requireHost(),
    params,
    getTranslations("Guests"),
    getLocale(),
  ]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();

  const [guests, answers] = await Promise.all([listGuestList(event.id), listAnswersByGuest(event.id)]);
  const counts = countRsvps(guests.map(asTally));

  return (
    <ClientMessages namespaces={["Guests"]}>
      <RefreshWhileWatching />
      <div className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        {/* Where the focus goes once a guest is removed (guest-row.tsx), since the button that did it goes too. */}
        <h1 id="guest-list-heading" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">
          {t("headcount", { count: counts.headcount })} ·{" "}
          {t("counts", { going: counts.going, maybe: counts.maybe, declined: counts.cant })}
        </p>
      </div>

      {guests.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        groupByStatus(guests).map((group) => (
          <section key={group.status} aria-labelledby={`${group.status}-heading`} className="flex flex-col gap-3">
            <h2 id={`${group.status}-heading`} className="text-lg font-medium">
              {t(`group.${group.status}`)} ({group.rsvps.length})
            </h2>
            {group.rsvps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("nobody")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {group.rsvps.map((guest) => (
                  <li key={guest.id}>
                    <GuestRow
                      eventId={event.id}
                      guest={guest}
                      replied={formatMoment(guest.repliedAt, event.timeZone, locale)}
                      changed={
                        guest.updatedAt > guest.repliedAt
                          ? formatMoment(guest.updatedAt, event.timeZone, locale)
                          : undefined
                      }
                      answers={answers[guest.id] ?? []}
                      savedAt={guest.updatedAt.toISOString()}
                      plusOnesAllowed={event.plusOnesAllowed}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
      <p className="text-sm text-muted-foreground">{t("live")}</p>
    </ClientMessages>
  );
}
