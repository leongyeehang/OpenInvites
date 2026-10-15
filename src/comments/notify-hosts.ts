import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import { eventHosts } from "@/events/hosts";
import type { Event } from "@/events/repository";
import { isMailConfigured } from "@/mail/config";
import { queueMail } from "@/mail/outbox";
import { kickMailWorker } from "@/mail/worker";
import { eventUrl } from "@/events/slug";

// Emails every host of the event about a new comment, when the event has it on and the instance has
// mail (spec, "Host notifications"): who commented, what they wrote, and the event link. A host who
// wrote it is not told of their own comment; the other hosts are. The mail is in the event's
// language, as the hosts' reply emails are. It never throws: the comment is already posted, and a
// failure here must not tell its author otherwise, so it is logged instead.
export async function notifyHostsOfComment(
  event: Pick<Event, "id" | "slug" | "customSlug" | "title" | "notifyOnComment" | "locale">,
  posted: { name: string; body: string; hostId: string | null },
): Promise<void> {
  if (!event.notifyOnComment || !isMailConfigured()) return;

  try {
    const t = await getTranslations({ locale: event.locale, namespace: "Mail.comment" });
    const values = { name: posted.name, title: event.title, comment: posted.body, url: eventUrl(event) };
    const subject = t("subject", values);
    const text = t("body", values);
    const hosts = (await eventHosts(event.id)).filter((host) => host.id !== posted.hostId);
    if (hosts.length === 0) return;
    await queueMail(hosts.map((host) => ({ eventId: event.id, to: host.email, subject, text })));
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the hosts' email about a comment on event ${event.id}:`, error);
  }
}
