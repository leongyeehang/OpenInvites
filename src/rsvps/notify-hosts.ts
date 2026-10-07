import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import { eventHosts } from "@/events/hosts";
import type { Event } from "@/events/repository";
import { baseUrl } from "@/instance/env";
import { isMailConfigured } from "@/mail/config";
import { queueMail } from "@/mail/outbox";
import { kickMailWorker } from "@/mail/worker";
import type { RsvpStatus } from "./form";
import { rsvpNotice } from "./notice";

// What the hosts' email says of an RSVP.
type RsvpShown = { name: string; status: RsvpStatus; plusOnes: number };

// Emails every host of the event about one RSVP, given as it was and as it is now (undefined where
// there was none), when the change is one they are told of (notice.ts), the event has it on, and
// the instance has mail (spec, "Host notifications"). The mail is in the event's language: the
// request queueing it is a guest's, or one host's on behalf of them all.
export async function notifyHostsOfRsvp(
  event: Pick<Event, "id" | "title" | "notifyOnRsvp" | "locale">,
  previous: RsvpShown | undefined,
  current: RsvpShown | undefined,
): Promise<void> {
  const notice = rsvpNotice(previous?.status ?? null, current?.status ?? null);
  const rsvp = current ?? previous;
  if (!notice || !rsvp || !event.notifyOnRsvp || !isMailConfigured()) return;

  const t = await getTranslations({ locale: event.locale, namespace: "Mail.rsvpReply" });
  const values = {
    name: rsvp.name,
    title: event.title,
    status: t(`status.${rsvp.status}`),
    plusOnes: rsvp.plusOnes,
    url: `${baseUrl()}/events/${event.id}/guests`,
  };
  const subject = t(`subject.${notice}`, values);
  const text = t(`body.${notice}`, values);
  const hosts = await eventHosts(event.id);
  await queueMail(hosts.map((host) => ({ eventId: event.id, to: host.email, subject, text })));
  after(kickMailWorker);
}
