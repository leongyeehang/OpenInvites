import { getTranslations } from "next-intl/server";
import { baseUrl } from "@/instance/env";
import type { Locale } from "@/locale/resolve-locale";
import type { QueuedMail } from "./outbox";

// A guest who can be emailed, as their RSVP has them: an email, the mail token of their stop link,
// and the language they replied in.
export type MailedGuest = { email: string; mailToken: string; locale: Locale };

// One email to one guest about an event, ready for the outbox (spec, "Guest mail"). The caller
// writes the subject and body in the guest's language; this ends the body, in the same language,
// with why they got it and the link to the page where one tap stops email about the event.
export async function guestMail(
  guest: MailedGuest,
  event: { id: string; title: string },
  { subject, body }: { subject: string; body: string },
): Promise<QueuedMail> {
  const t = await getTranslations({ locale: guest.locale, namespace: "Mail" });
  const footer = t("guestFooter", { title: event.title, url: `${baseUrl()}/m/${guest.mailToken}` });
  return { eventId: event.id, to: guest.email, subject, text: `${body}\n\n${footer}` };
}
