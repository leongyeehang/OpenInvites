import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHost } from "@/auth/session";
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
import { CoHostLinkForm } from "./co-host-link-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Hosts");
  return { title: t("title") };
}

// Who hosts the event (spec, "Co-hosts"): for its owner, the hosts with a way to remove each
// co-host, the co-host links still waiting to be used, and the way to make another. A co-host
// finds here only the way to leave.
export default async function HostsPage({ params }: PageProps<"/events/[id]/hosts">) {
  const [host, { id }, t] = await Promise.all([requireHost(), params, getTranslations("Hosts")]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>
      {can(event.role, "manageCoHosts") ? <OwnersView event={event} /> : <LeaveEvent event={event} />}
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

  return (
    <>
      <p className="text-muted-foreground">{t("explainer")}</p>
      <ul className="flex flex-col gap-2">
        <li className="flex flex-wrap items-center gap-2 rounded-xl p-3 ring-1 ring-foreground/10">
          <span className="font-medium break-all">{owner.name}</span>
          <Badge>{t("host")}</Badge>
        </li>
        {coHosts.map((coHost) => (
          <li key={coHost.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
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
              <AlertDialogContent>
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
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>

      <section aria-labelledby="links-heading" className="flex flex-col gap-3">
        <h2 id="links-heading" className="text-lg font-medium">
          {t("links")}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("linksEmpty")}</p>
        ) : (
          // Times in the event's own zone, as everywhere else on the host's pages.
          <ul className="flex flex-col gap-2">
            {pending.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
                <span className="text-sm text-muted-foreground">
                  {t("linkDates", {
                    made: formatMoment(link.createdAt, event.timeZone, locale),
                    expires: formatMoment(link.expiresAt, event.timeZone, locale),
                  })}
                </span>
                <form action={revokeCoHostLinkAction.bind(null, event.id, link.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    {t("revoke")}
                  </Button>
                </form>
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
      </section>
    </>
  );
}

async function LeaveEvent({ event }: { event: HostEvent }) {
  const t = await getTranslations("Hosts");
  return (
    <>
      <p className="text-muted-foreground">{t("coHostIntro")}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="self-start">
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
    </>
  );
}
