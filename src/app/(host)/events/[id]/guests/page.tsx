import type { Metadata } from "next";
import type { ReactNode } from "react";
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

// Everyone who has answered, grouped as the host plans (Going, the waitlist in its order, Maybe,
// Can't go), with the headcount the host is really after, against the capacity when there is one.
// The waitlist is shown once the event has a capacity, or anyone is on it. The list refreshes
// itself while the host watches.
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
  const groups = groupByStatus(guests).filter((group) => group.status !== "waitlisted" || event.capacity !== null || group.rsvps.length > 0);

  return (
    <ClientMessages namespaces={["Guests"]}>
      <RefreshWhileWatching />
      <div className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        {/* Where the focus goes once a guest is removed or moved to Going (guest-row.tsx), since the button that did it goes too. */}
        <h1 id="guest-list-heading" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">
          {event.capacity === null
            ? t("headcount", { count: counts.headcount })
            : t("headcountOf", { count: counts.headcount, capacity: event.capacity })}{" "}
          · {t("counts", { going: counts.going, maybe: counts.maybe, declined: counts.cant })}
          {counts.waitlisted > 0 && ` · ${t("waitlistedCount", { count: counts.waitlisted })}`}
        </p>
      </div>

      {guests.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        groups.map((group) => (
          <section key={group.status} aria-labelledby={`${group.status}-heading`} className="flex flex-col gap-3">
            <h2 id={`${group.status}-heading`} className="text-lg font-medium">
              {t(`group.${group.status}`)} ({group.rsvps.length})
            </h2>
            {group.rsvps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("nobody")}</p>
            ) : (
              // The waitlist is in order, and numbered: a list that numbers itself for a screen
              // reader, the numbers on its rows for the eye.
              <GuestItems ordered={group.status === "waitlisted"}>
                {group.rsvps.map((guest, index) => (
                  <li key={guest.id}>
                    <GuestRow
                      eventId={event.id}
                      guest={guest}
                      position={group.status === "waitlisted" ? index + 1 : undefined}
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
              </GuestItems>
            )}
          </section>
        ))
      )}
      <p className="text-sm text-muted-foreground">{t("live")}</p>
    </ClientMessages>
  );
}

function GuestItems({ ordered, children }: { ordered: boolean; children: ReactNode }) {
  return ordered ? <ol className="flex flex-col gap-3">{children}</ol> : <ul className="flex flex-col gap-3">{children}</ul>;
}
