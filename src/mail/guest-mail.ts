import { baseUrl } from "@/instance/env";
import { translatorFor, type Translator } from "@/locale/messages";
import type { Locale } from "@/locale/resolve-locale";
import type { QueuedMail } from "./outbox";

// A guest who can be emailed, as their RSVP has them: an email, the mail token of their stop link,
// and the language they replied in.
export type MailedGuest = { email: string; mailToken: string; locale: Locale };

// What one email to a guest says above its footer, written by the caller with a translator in the
// guest's language.
export type GuestMailContent = { subject: string; body: string };

// One email to one guest about an event, ready for the outbox (spec, "Guest mail"). The caller
// writes the subject and body in the guest's language, and passes the translator it wrote them
// with; this ends the body, in the same language, with why they got it and the link to the page
// where one tap stops email about the event.
export function guestMail(guest: MailedGuest, event: { id: string; title: string }, { subject, body }: GuestMailContent, t: Translator): QueuedMail {
  const footer = t("Mail.guestFooter", { title: event.title, url: `${baseUrl()}/m/${guest.mailToken}` });
  return { eventId: event.id, to: guest.email, subject, text: `${body}\n\n${footer}` };
}

// One email to each guest, each written by `write` in the language that guest replied in. It
// needs no request, so actions and the mail worker build guest mail alike.
export async function guestMails<G extends MailedGuest>(
  event: { id: string; title: string },
  guests: G[],
  write: (guest: G, t: Translator) => GuestMailContent,
): Promise<QueuedMail[]> {
  return Promise.all(
    guests.map(async (guest) => {
      const t = await translatorFor(guest.locale);
      return guestMail(guest, event, write(guest, t), t);
    }),
  );
}
