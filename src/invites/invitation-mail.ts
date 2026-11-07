import type { Event } from "@/events/repository";
import { formatWhen, isDated } from "@/events/time";
import type { Translator } from "@/locale/messages";
import type { GuestMailContent } from "@/mail/guest-mail";
import { inviteUrl } from "./invite";

// The invitation email (M6 spec, "The invitation email"), in the event's language, which the host
// writes the letters in: who invited the guest to what, the host's letter to them when there is
// one, when (in the event's zone) and where when they are known, and their personal invite link;
// on an invite-only event, that opening it asks for a code sent to this address. Plain words and a
// link, never a picture. The footer with the stop link is added by guestMails, with the
// invitation's own reason for the email, as an invite has no reply to point at.
export function invitationMail(
  event: Pick<Event, "title" | "startsAt" | "endsAt" | "allDay" | "timeZone" | "location" | "locale" | "inviteOnly">,
  invite: { name: string; letter: string; token: string },
  hostName: string,
  t: Translator,
): GuestMailContent {
  const values = {
    host: hostName,
    title: event.title,
    name: invite.name,
    lettered: invite.letter ? "yes" : "no",
    letter: invite.letter,
    // A published event whose date poll is open has no date yet.
    dated: isDated(event) ? "yes" : "no",
    when: isDated(event) ? formatWhen(event, event.locale) : "",
    located: event.location ? "yes" : "no",
    location: event.location,
    url: inviteUrl(invite.token),
    inviteOnly: event.inviteOnly ? "yes" : "no",
  };
  return { subject: t("Mail.invitation.subject", values), body: t("Mail.invitation.body", values) };
}
