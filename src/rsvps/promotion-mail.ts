import type { Event } from "@/events/repository";
import { eventUrl } from "@/events/slug";
import { formatWhen } from "@/events/time";
import type { Translator } from "@/locale/messages";
import type { Locale } from "@/locale/resolve-locale";
import type { GuestMailContent } from "@/mail/guest-mail";

// The one email a guest gets when a place opens up for them on the waitlist (spec, "Capacity and
// the waitlist"), in the language they replied in: that they are going, when (in the event's
// zone), where when there is a place, and the event link. The footer with the stop link is added
// by guestMails, as on every email to a guest.
export function promotionMail(
  event: Pick<Event, "title" | "slug" | "customSlug" | "startsAt" | "endsAt" | "allDay" | "timeZone" | "location">,
  guest: { locale: Locale },
  t: Translator,
): GuestMailContent {
  const values = {
    title: event.title,
    when: formatWhen(event, guest.locale),
    located: event.location ? "yes" : "no",
    location: event.location,
    url: eventUrl(event),
  };
  return { subject: t("Mail.promoted.subject", values), body: t("Mail.promoted.body", values) };
}
