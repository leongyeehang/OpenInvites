import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventHosts } from "@/events/hosts";
import { findHostEvent, type HostEvent } from "@/events/repository";
import { formatMoment } from "@/events/time";
import { leaveEventAction, removeCoHostAction, revokeCoHostLinkAction } from "@/hosts/actions";
import { CO_HOST_LINK_DAYS, coHostLinkState, MAX_CO_HOSTS, roomForCoHost } from "@/hosts/co-host-link";
import { listCoHostLinks } from "@/hosts/repository";
import { can } from "@/hosts/role";
import { ClientMessages } from "@/locale/client-messages";
import { Glass, Veil } from "@/themes/glass";
import { ManageHeading } from "../manage-heading";
import { CoHostLinkForm } from "./co-host-link-form";
import { RevokeLinkForm } from "./revoke-link-form";

// Where the focus goes once a co-host, or a co-host link, is taken off the page, since the button
// that did it goes too: the page's heading, and the links' heading.
const HEADING = "hosts-heading";
const LINKS_HEADING = "links-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Hosts");
  return { title: t("title") };
}

// Who hosts the event (spec, "Co-hosts"): for its owner, the hosts with a way to remove each
// co-host, the co-host links still waiting to be used, and the way to make another. A co-host
// finds here only the way to leave. On the event's poster (layout.tsx), the heading and the line
// under it sit on the veil, the rest in glass panels (M8 ticket 21).
export default async function HostsPage({ params }: PageProps<"/events/[id]/hosts">) {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Hosts")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();

  const owns = can(event.role, "manageCoHosts");

  return (
    <>
      <Veil className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="w-fit text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        <ManageHeading font={event.theme.font} id={HEADING}>
          {t("title")}
        </ManageHeading>
        <p className="text-muted-foreground">{owns ? t("explainer") : t("coHostIntro")}</p>
      </Veil>
      {owns ? <OwnersView event={event} /> : <LeaveEvent event={event} />}
    </>
  );
}

async function OwnersView({ event }: { event: HostEvent }) {
  const [t, locale, [owner, ...coHosts], links] = await Promise.all([
    getTranslations("Hosts"),
    getLocale(),
    eventHosts(event.id),
    listCoHostLinks(event.id),
  ]);
  const now = new Date();
  const pending = links.filter((link) => coHostLinkState(link, now) === "pending");

  // The hosts in one glass panel and the links in another, each divided by the glass's edge.
  return (
    <>
      <Glass>
        <ul className="flex flex-col divide-y divide-theme-glass-border">
          <li className="flex flex-wrap items-center gap-2 p-4">
            <span className="font-medium break-all">{owner.name}</span>
            <Badge>{t("host")}</Badge>
          </li>
          {coHosts.map((coHost) => (
            <li key={coHost.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium break-all">{coHost.name}</span>
                <Badge variant="secondary">{t("coHost")}</Badge>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    {t("remove")}
                  </Button>
                </AlertDialogTrigger>
                <DeleteDialogContent focusAfter={HEADING}>
                  <form action={removeCoHostAction.bind(null, event.id, coHost.id)}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("removeTitle", { name: coHost.name })}</AlertDialogTitle>
                      <AlertDialogDescription>{t("removeText")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                      <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
                      <Button type="submit" variant="destructive">
                        {t("removeConfirm")}
                      </Button>
                    </AlertDialogFooter>
                  </form>
                </DeleteDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      </Glass>

      <section aria-labelledby={LINKS_HEADING}>
        <Glass className="flex flex-col gap-3 p-4 md:p-5">
          <h2 id={LINKS_HEADING} tabIndex={-1} className="text-lg font-medium outline-none">
            {t("links")}
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("linksEmpty")}</p>
          ) : (
            // Times in the event's own zone, as everywhere else on the host's pages.
            <ul className="flex flex-col divide-y divide-theme-glass-border border-y border-theme-glass-border">
              {pending.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-muted-foreground">
                    {t("linkDates", {
                      made: formatMoment(link.createdAt, event.timeZone, locale),
                      expires: formatMoment(link.expiresAt, event.timeZone, locale),
                    })}
                  </span>
                  <RevokeLinkForm revoke={revokeCoHostLinkAction.bind(null, event.id, link.id)} focusAfter={LINKS_HEADING}>
                    <Button type="submit" variant="outline" size="sm">
                      {t("revoke")}
                    </Button>
                  </RevokeLinkForm>
                </li>
              ))}
            </ul>
          )}
          {roomForCoHost(coHosts.length) ? (
            <ClientMessages namespaces={["Hosts"]}>
              <CoHostLinkForm eventId={event.id} days={CO_HOST_LINK_DAYS} />
            </ClientMessages>
          ) : (
            <p className="text-sm">{t("full", { max: MAX_CO_HOSTS })}</p>
          )}
        </Glass>
      </section>
    </>
  );
}

async function LeaveEvent({ event }: { event: HostEvent }) {
  const t = await getTranslations("Hosts");
  // Leave alone, in a glass panel of its own: the line that says what it does is on the veil above.
  return (
    <Glass className="p-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            {t("leave")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form action={leaveEventAction.bind(null, event.id)}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("leaveTitle", { title: event.title })}</AlertDialogTitle>
              <AlertDialogDescription>{t("leaveText")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-4">
              <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
              <Button type="submit" variant="destructive">
                {t("leaveConfirm")}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Glass>
  );
}
