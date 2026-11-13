import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { formatMoment } from "@/events/time";
import { ClientMessages } from "@/locale/client-messages";
import { inviteState } from "@/invites/invite";
import { listInvites } from "@/invites/repository";
import { listAnswersByGuest } from "@/questions/repository";
import { asTally, countRsvps, groupByStatus } from "@/rsvps/counts";
import { listGuestList } from "@/rsvps/repository";
import { Glass, Veil } from "@/themes/glass";
import { ManageHeading } from "../manage-heading";
import { GuestRow } from "./guest-row";
import { RefreshWhileWatching } from "./refresh-every";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Guests");
  return { title: t("title") };
}

// Everyone who has answered, grouped as the host plans (waiting for their approval, Going, the
// waitlist in its order, Maybe, Can't go, declined), with the headcount the host is really after,
// against the capacity when there is one. The waitlist is shown once the event has a capacity, or
// anyone is on it; the replies waiting for approval and those declined once the event asks for
// approval, or anyone is in them. Last, once the host has made any personal invites, the guests
// invited who have not replied (spec, "Personal invite links"): not RSVPs, so not grouped with them
// and counted nowhere, in the headline or anywhere else. The list refreshes itself while the host
// watches. On the event's poster (layout.tsx), the heading and the headcount sit on the veil and
// each section is a glass panel holding its rows (M8 ticket 21).
export default async function GuestListPage({ params }: PageProps<"/events/[id]/guests">) {
  const [host, { id }, t, locale] = await Promise.all([
    requireHost(),
    params,
    getTranslations("Guests"),
    getLocale(),
  ]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();

  const [guests, answers, invites] = await Promise.all([listGuestList(event.id), listAnswersByGuest(event.id), listInvites(event.id)]);
  const unanswered = invites.filter((invite) => inviteState(invite) !== "replied");
  const counts = countRsvps(guests.map(asTally));
  const groups = groupByStatus(guests).filter(({ group, rsvps }) => {
    if (rsvps.length > 0) return true;
    if (group === "waitlisted") return event.capacity !== null;
    if (group === "pending" || group === "declined") return event.approvalRequired;
    return true;
  });

  return (
    <ClientMessages namespaces={["Guests"]}>
      <RefreshWhileWatching />
      <Veil className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="w-fit text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        {/* Where the focus goes once a guest is removed, moved to Going, approved or declined (guest-row.tsx), since the button that did it goes too. */}
        <ManageHeading font={event.theme.font} id="guest-list-heading">
          {t("title")}
        </ManageHeading>
        <p className="text-muted-foreground">
          {event.capacity === null
            ? t("headcount", { count: counts.headcount })
            : t("headcountOf", { count: counts.headcount, capacity: event.capacity })}{" "}
          · {t("counts", { going: counts.going, maybe: counts.maybe, declined: counts.cant })}
          {counts.waitlisted > 0 && ` · ${t("waitlistedCount", { count: counts.waitlisted })}`}
          {counts.pending > 0 && ` · ${t("pendingCount", { count: counts.pending })}`}
        </p>
      </Veil>

      {guests.length === 0 ? (
        <Glass className="p-4">
          <p className="text-muted-foreground">{t("empty")}</p>
        </Glass>
      ) : (
        groups.map((group) => (
          <GuestSection key={group.group} id={`${group.group}-heading`} heading={`${t(`group.${group.group}`)} (${group.rsvps.length})`}>
            {group.rsvps.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">{t("nobody")}</p>
            ) : (
              // The waitlist is in order, and numbered: a list that numbers itself for a screen
              // reader, the numbers on its rows for the eye.
              <GuestItems ordered={group.group === "waitlisted"}>
                {group.rsvps.map((guest, index) => (
                  <li key={guest.id} className="p-4">
                    <GuestRow
                      eventId={event.id}
                      guest={guest}
                      position={group.group === "waitlisted" ? index + 1 : undefined}
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
          </GuestSection>
        ))
      )}
      {invites.length > 0 && (
        <GuestSection id="invited-heading" heading={`${t("group.invited")} (${unanswered.length})`}>
          {unanswered.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">{t("nobody")}</p>
          ) : (
            <GuestItems ordered={false}>
              {unanswered.map((invite) => (
                <li key={invite.id} className="p-4">
                  <p className="font-medium break-words">{invite.name}</p>
                  {invite.email && <p className="text-sm break-all text-muted-foreground">{invite.email}</p>}
                  <p className="text-sm text-muted-foreground">{invite.openedAt ? t("invited.opened") : t("invited.notOpened")}</p>
                </li>
              ))}
            </GuestItems>
          )}
        </GuestSection>
      )}
      <Veil>
        <p className="text-sm text-muted-foreground">{t("live")}</p>
      </Veil>
    </ClientMessages>
  );
}

// One section of the list, its heading and its rows in one glass panel (M8 ticket 21): one panel,
// not one per row, as a list can hold hundreds and each panel is a blur to paint.
function GuestSection({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Glass className="flex flex-col">
        <h2 id={id} className="px-4 pt-4 pb-3 text-lg font-medium">
          {heading}
        </h2>
        {children}
      </Glass>
    </section>
  );
}

// The rows, divided by the glass's edge.
function GuestItems({ ordered, children }: { ordered: boolean; children: ReactNode }) {
  const className = "flex flex-col divide-y divide-theme-glass-border border-t border-theme-glass-border";
  return ordered ? <ol className={className}>{children}</ol> : <ul className={className}>{children}</ul>;
}
