import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import type { Event } from "@/events/repository";
import { baseUrl } from "@/instance/env";
import { isMailConfigured } from "@/mail/config";
import { guestMail } from "@/mail/guest-mail";
import { queueMail } from "@/mail/outbox";
import { kickMailWorker } from "@/mail/worker";
import { cancellationAudience } from "./cancellation";
import { listMailableRsvps } from "./repository";

// Emails the guests who are told when the host cancels the event (cancellation.ts), each in the
// language they replied in, when the instance has mail (spec, "Cancellation notice"). It never
// throws: the event is already cancelled, and a failure here must not tell the host otherwise, so
// it is logged instead.
export async function notifyGuestsOfCancellation(event: Pick<Event, "id" | "title" | "slug">): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const values = { title: event.title, url: `${baseUrl()}/e/${event.slug}` };
    const guests = cancellationAudience(await listMailableRsvps(event.id));
    const rows = await Promise.all(
      guests.map(async (guest) => {
        const t = await getTranslations({ locale: guest.locale, namespace: "Mail.cancelled" });
        return guestMail(guest, event, { subject: t("subject", values), body: t("body", values) });
      }),
    );
    await queueMail(rows);
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the guests' email about the cancellation of event ${event.id}:`, error);
  }
}
