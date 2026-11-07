import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import { eventHosts } from "@/events/hosts";
import type { Event } from "@/events/repository";
import { isMailConfigured } from "@/mail/config";
import { queueMail } from "@/mail/outbox";
import { kickMailWorker } from "@/mail/worker";
import { eventUrl } from "@/events/slug";

// Emails every host of the event once about one upload whose photos wait for their approval, when
// the event has it on and the instance has mail (spec, "The album: who sees it, and approval"):
// who added them, how many, and the event link, where the hosts approve them. Only a guest's photos
// wait, so no host is told of their own. The mail is in the event's language, as the hosts' other
// emails are. It never throws: the photos are already added, and a failure here must not tell the
// guest otherwise, so it is logged instead.
export async function notifyHostsOfPhotos(
  event: Pick<Event, "id" | "slug" | "customSlug" | "title" | "notifyOnPhoto" | "locale">,
  posted: { name: string; count: number },
): Promise<void> {
  if (!event.notifyOnPhoto || !isMailConfigured()) return;

  try {
    const t = await getTranslations({ locale: event.locale, namespace: "Mail.photos" });
    const values = { name: posted.name, count: posted.count, title: event.title, url: eventUrl(event) };
    const subject = t("subject", values);
    const text = t("body", values);
    const hosts = await eventHosts(event.id);
    await queueMail(hosts.map((host) => ({ eventId: event.id, to: host.email, subject, text })));
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the hosts' email about photos added to event ${event.id}:`, error);
  }
}
