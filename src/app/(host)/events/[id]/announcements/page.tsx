import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAnnouncementAction } from "@/announcements/actions";
import { listAnnouncements } from "@/announcements/repository";
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
import { Button } from "@/components/ui/button";
import { findHostEvent } from "@/events/repository";
import { formatMoment, formatWhen } from "@/events/time";
import { baseUrl } from "@/instance/env";
import { ClientMessages } from "@/locale/client-messages";
import { isMailConfigured } from "@/mail/config";
import { AnnouncementForm } from "./announcement-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Announcements");
  return { title: t("title") };
}

// The host's announcements for one event (spec, "Announcements"): the form that posts one, then
// every one posted, newest first, with when it went and to whom, each of which can be taken down.
// Times are in the event's own zone, as on the guest list.
export default async function AnnouncementsPage({ params }: PageProps<"/events/[id]/announcements">) {
  const [host, { id }, t, locale, format] = await Promise.all([
    requireHost(),
    params,
    getTranslations("Announcements"),
    getLocale(),
    getFormatter(),
  ]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  const announcements = await listAnnouncements(event.id);
  const mail = isMailConfigured();
  // The reminder "Send a reminder now" fills in, in the host's language: the event's time in its
  // own zone (the date alone for an all-day event), and where, when the host said.
  const reminder = t("reminderDraft", {
    title: event.title,
    when: formatWhen(event, locale),
    located: event.location ? "yes" : "no",
    location: event.location,
    url: `${baseUrl()}/e/${event.slug}`,
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/events/${event.id}`} className="text-sm text-muted-foreground hover:underline">
          {t("backToEvent")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>
      <div className="flex flex-col gap-2 text-muted-foreground">
        <p>{t("explainer")}</p>
        {!event.askEmail && <p>{t("askEmailHint")}</p>}
        {!mail && <p>{t("noMail")}</p>}
      </div>

      <ClientMessages namespaces={["Announcements"]}>
        <AnnouncementForm eventId={event.id} reminder={reminder} mail={mail} />
      </ClientMessages>

      {announcements.length > 0 && (
        <ul className="flex flex-col gap-3">
          {announcements.map((each) => (
            <li key={each.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm text-muted-foreground">
                  <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, event.timeZone, locale)}</time>
                  {/* Without mail nothing was sent to anyone; the page says so above. */}
                  {mail && <> · {t("sentTo", { audience: format.list(each.audience.map((status) => t(`status.${status}`))) })}</>}
                </p>
                {/* Taking one down cannot be undone, so it is confirmed. */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {t("delete")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <form action={deleteAnnouncementAction.bind(null, event.id, each.id)}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="pt-4">
                        <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
                        <Button type="submit" variant="destructive">
                          {t("deleteConfirm")}
                        </Button>
                      </AlertDialogFooter>
                    </form>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="mt-2 break-words whitespace-pre-line">{each.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
