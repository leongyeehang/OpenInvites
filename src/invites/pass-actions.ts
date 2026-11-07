"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { findEventBySlug } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { authSecret } from "@/instance/env";
import { isMailConfigured } from "@/mail/config";
import { consume } from "@/rate-limit/rate-limit";
import { sendCode, type CodeMail } from "@/rsvps/email-code";
import { isEmail } from "@/rsvps/form";
import { tryEmailCode } from "@/rsvps/repository";
import { rsvpCookieOptions } from "@/rsvps/token";
import { passCookieName, passExpiresAt, signPass } from "./pass";
import { findInviteByEmail } from "./repository";

// Why the locked page did not let the guest in. The guest's own browser turns it into a sentence.
// None of them says whether the email is on the invite list.
export type PassRefusal = "codeWrong" | "codeExpired" | "tooFast" | "emailInvalid";

// What asking did: a code is on its way if the email is on the list (with how long until another
// can be sent), or why not. A right code sets the pass and draws the page again, as the invitation.
export type PassState = { error?: PassRefusal; sent?: { email: string; resendIn: number } } | undefined;

// The code's email to an invitee on the locked page, in the language they asked in.
function passMail(event: { title: string }): CodeMail {
  return (t, code) => ({ subject: t("pass.subject", { title: event.title }), text: t("pass.body", { title: event.title, code }) });
}

// The locked page's form (M6 spec, "How a pass is granted"): an invitee proves the email the host
// invited them with by a six-digit code sent to it, under the rules of the RSVP form's code (ten
// minutes, five tries, another after thirty seconds), and this device is given a pass. Every post
// counts against the RSVP limit, and every one that asks for a code against the mail limit too,
// before anything is looked up, so a refusal never says whether the address is on the list. The
// answer to an address that is not on it is the one an address on it gets: a code is stored for it
// all the same and never sent (rsvps/email-code.ts, sendCode), so a wrong, dead or too-soon code is
// answered alike too. The code is kept under the invite's email as the host wrote it, so a guest
// may type it in any case.
export async function passAction(slug: string, _: PassState, formData: FormData): Promise<PassState> {
  const requestHeaders = await headers();
  const code = formData.get("code");
  if (!(await consume("rsvp", requestHeaders)).allowed) return { error: "tooFast" };
  if (typeof code !== "string" && !(await consume("mail", requestHeaders)).allowed) return { error: "tooFast" };
  const posted = formData.get("email");
  const email = typeof posted === "string" ? posted.trim() : "";
  if (!isEmail(email)) return { error: "emailInvalid" };

  // Only a published or cancelled invite-only event has a locked page to ask from, and only an
  // instance with mail can send the code. Anything else is drawn again as it now is.
  const event = await findEventBySlug(slug);
  if (!event) return undefined;
  if (!event.inviteOnly || event.state === "draft" || !isMailConfigured()) {
    for (const path of eventPaths(event)) revalidatePath(path);
    return undefined;
  }

  const invite = await findInviteByEmail(event.id, email);
  const address = invite?.email ?? email.toLowerCase();
  const now = new Date();
  const secret = authSecret();
  if (typeof code !== "string") {
    const sent = await sendCode(event, address, { write: invite && passMail(event), mailAllowed: async () => true, afterAnswer: true }, now, secret);
    return sent.codeSent ? { sent: { email, resendIn: sent.codeSent.resendIn } } : { error: "tooFast" };
  }

  const { verdict } = await tryEmailCode(event.id, address, code, now, secret);
  // A right code for an address not on the list can only be one sent for the RSVP form, or one
  // whose invite the host deleted since: it lets nobody in.
  if (verdict === "ok" && invite) {
    const pass = signPass({ eventId: event.id, inviteId: invite.id, expiresAt: passExpiresAt(now) }, secret);
    (await cookies()).set(passCookieName(event.id), pass, rsvpCookieOptions());
    for (const path of eventPaths(event)) revalidatePath(path);
    return undefined;
  }
  // A code out of tries, or expired, or never sent, is not replaced here: "Send it again" asks for
  // a new one, once the thirty seconds since the last are up.
  return { error: verdict === "ok" || verdict === "wrong" ? "codeWrong" : "codeExpired" };
}
