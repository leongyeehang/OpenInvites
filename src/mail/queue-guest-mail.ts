import { after } from "next/server";
import type { Translator } from "@/locale/messages";
import { guestMails, type GuestMailContent, type MailedGuest } from "./guest-mail";
import { queueMail } from "./outbox";
import { kickMailWorker } from "./worker";

// An action emailing guests about an event (the cancellation notice, an announcement): one email
// to each, written by `write` in the language they replied in (guest-mail.ts), queued, and sent as
// soon as the action has answered. It never throws: what the action did is done already, and a
// failure here must not tell the host otherwise, so it is logged instead, saying what the mail was
// `about` ("the cancellation of", "an announcement to").
export async function queueGuestMail<G extends MailedGuest>(
  event: { id: string; title: string },
  guests: G[],
  write: (guest: G, t: Translator) => GuestMailContent,
  about: string,
): Promise<void> {
  if (guests.length === 0) return;
  try {
    await queueMail(await guestMails(event, guests, write));
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the guests' email about ${about} event ${event.id}:`, error);
  }
}
