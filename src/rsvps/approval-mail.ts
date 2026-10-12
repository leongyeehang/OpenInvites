import type { Event } from "@/events/repository";
import { eventUrl } from "@/events/slug";
import type { Translator } from "@/locale/messages";
import type { Locale } from "@/locale/resolve-locale";
import type { GuestMailContent } from "@/mail/guest-mail";
import type { SavedStatus } from "./form";

// The one email a guest gets when a host approves their reply (spec, "Approval"), in the language
// they replied in: "You're in", with their reply and the event link; or, for a Going reply that
// approving put on the waitlist, that they are on it and their place. The footer with the stop
// link is added by guestMails, as on every email to a guest.
export function approvalMail(
  event: Pick<Event, "title" | "slug" | "customSlug">,
  guest: { status: SavedStatus; plusOnes: number; locale: Locale },
  position: number | null,
  t: Translator,
): GuestMailContent {
  const values = { title: event.title, status: guest.status, plusOnes: guest.plusOnes, position: position ?? 0, url: eventUrl(event) };
  const message = guest.status === "waitlisted" ? "approvedWaitlisted" : "approved";
  return { subject: t(`Mail.${message}.subject`, values), body: t(`Mail.${message}.body`, values) };
}
