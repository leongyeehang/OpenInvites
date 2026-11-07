import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import { getDb } from "@/db/client";
import { authSecret } from "@/instance/env";
import { sendMail } from "@/mail/send";
import { consume } from "@/rate-limit/rate-limit";
import type { SaveRsvpResult } from "./guest";
import { createEmailCode, deleteEmailCode, findEmailCode, tryEmailCode } from "./repository";
import { CODE_MINUTES, generateCode, hashCode, RESEND_SECONDS, resendWait } from "./verification";

// Proving the email a guest gave (spec, "Contact details"): the step between their answer and its
// save, when the host asks for it (needsCode). An answer posted without a code sends one to the
// address; one posted with a code has it checked, and a dead code is replaced by a new one.
// "proven" lets the reply be saved and marked so; anything else is what the guest is told.
export async function proveEmail(
  event: { id: string; title: string },
  email: string,
  typed: FormDataEntryValue | null,
  requestHeaders: Headers,
): Promise<"proven" | SaveRsvpResult> {
  const now = new Date();
  const secret = authSecret();
  // Counted against the client's mail limit, as every email a request sends is.
  const mailAllowed = async () => (await consume("mail", requestHeaders)).allowed;
  // "Send it again" posts no code, as the first answer does: either asks for one.
  if (typeof typed !== "string") return sendCode(event, email, { write: rsvpCodeMail(event), mailAllowed }, now, secret);
  const { verdict, triesLeft } = await tryEmailCode(event.id, email, typed, now, secret);
  if (verdict === "ok") return "proven";
  if (verdict === "wrong") return { error: "codeWrong", triesLeft };
  const resent = await sendCode(event, email, { write: rsvpCodeMail(event), mailAllowed }, now, secret);
  return resent.error ? resent : { ...resent, error: verdict === "expired" ? "codeExpired" : "codeResent" };
}

// The code's email on the RSVP form, in the language the guest is answering in.
function rsvpCodeMail(event: { title: string }): CodeMail {
  return (t, code) => ({ subject: t("code.subject", { title: event.title }), text: t("code.body", { title: event.title, code }) });
}

// What an email carrying a code says, written with the request's `Mail` messages: the RSVP form's
// (above), or the locked page's (invites/pass-actions.ts).
export type CodeMail = (t: Awaited<ReturnType<typeof getTranslations<"Mail">>>, code: string) => { subject: string; text: string };

// Thrown inside the write to undo it when the mail limit refuses the code.
class MailRefused extends Error {}

// One code to one address, every way one is asked for. It is stored first, and only when the last
// code to the address went thirty seconds ago or more (createEmailCode decides that as it writes),
// and only then counted against the client's mail limit (`mailAllowed`), as every email a request
// sends is; a refusal undoes the write, so the code sent before stays the one to enter. It goes at
// once with sendMail rather than through the outbox, because the guest is waiting for it, in the
// language they are answering in, as `write` words it. It has no footer and no stop link: it is
// sent before their RSVP is kept, so there is no RSVP whose mail could be stopped.
//
// The locked page (invites/pass-actions.ts) must answer an address on the invite list as it answers
// one that is not, and as quickly: for the one not on it there is no `write`, so the code is stored
// and answered for but never sent; for the one on it, `afterAnswer` sends it once the answer has
// gone, so the wait for the mail server does not tell them apart.
export async function sendCode(
  event: { id: string; title: string },
  email: string,
  { write, mailAllowed, afterAnswer = false }: { write: CodeMail | undefined; mailAllowed: () => Promise<boolean>; afterAnswer?: boolean },
  now: Date,
  secret: string,
): Promise<SaveRsvpResult> {
  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000);
  let stored;
  try {
    stored = await getDb().transaction(async (tx) => {
      const created = await createEmailCode(event.id, email, hashCode(code, secret), expiresAt, tx);
      if (created && !(await mailAllowed())) throw new MailRefused();
      return created;
    });
  } catch (error) {
    if (error instanceof MailRefused) return { error: "codeTooFast" };
    throw error;
  }
  if (!stored) {
    const last = await findEmailCode(event.id, email);
    return { error: "codeTooSoon", codeSent: { email, resendIn: resendWait(last, new Date()) } };
  }

  if (!write) return { codeSent: { email, resendIn: RESEND_SECONDS } };
  const message = { to: email, ...write(await getTranslations("Mail"), code) };
  const storedId = stored.id;
  const deliver = async () => {
    try {
      await sendMail(message);
    } catch (error) {
      // Nothing went, so nothing waits to be entered, and asking again is not "too soon".
      await deleteEmailCode(storedId);
      throw error;
    }
  };
  if (afterAnswer) after(deliver);
  else await deliver();
  return { codeSent: { email, resendIn: RESEND_SECONDS } };
}
