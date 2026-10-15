import { getTranslations } from "next-intl/server";
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
  // "Send it again" posts no code, as the first answer does: either asks for one.
  if (typeof typed !== "string") return sendCode(event, email, requestHeaders, now, secret);
  const { verdict, triesLeft } = await tryEmailCode(event.id, email, typed, now, secret);
  if (verdict === "ok") return "proven";
  if (verdict === "wrong") return { error: "codeWrong", triesLeft };
  const resent = await sendCode(event, email, requestHeaders, now, secret);
  return resent.error ? resent : { ...resent, error: verdict === "expired" ? "codeExpired" : "codeResent" };
}

// Thrown inside the write to undo it when the mail limit refuses the code.
class MailRefused extends Error {}

// One code to one address, every way one is asked for. It is stored first, and only when the last
// code to the address went thirty seconds ago or more (createEmailCode decides that as it writes),
// and only then counted against the client's mail limit, as every email a request sends is; a
// refusal undoes the write, so the code sent before stays the one to enter. It goes at once with
// sendMail rather than through the outbox, because the guest is waiting for it, in the language
// they are answering in. It has no footer and no stop link: it is sent before their RSVP is kept,
// so there is no RSVP whose mail could be stopped.
async function sendCode(
  event: { id: string; title: string },
  email: string,
  requestHeaders: Headers,
  now: Date,
  secret: string,
): Promise<SaveRsvpResult> {
  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000);
  let stored;
  try {
    stored = await getDb().transaction(async (tx) => {
      const created = await createEmailCode(event.id, email, hashCode(code, secret), expiresAt, tx);
      if (created && !(await consume("mail", requestHeaders)).allowed) throw new MailRefused();
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

  const t = await getTranslations("Mail.code");
  try {
    await sendMail({ to: email, subject: t("subject", { title: event.title }), text: t("body", { title: event.title, code }) });
  } catch (error) {
    // Nothing went, so nothing waits to be entered, and asking again is not "too soon".
    await deleteEmailCode(stored.id);
    throw error;
  }
  return { codeSent: { email, resendIn: RESEND_SECONDS } };
}
