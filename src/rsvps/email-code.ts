import { getTranslations } from "next-intl/server";
import { sendMail } from "@/mail/send";
import { consume } from "@/rate-limit/rate-limit";
import type { SaveRsvpResult } from "./guest";
import { createEmailCode, findEmailCode, tryEmailCode } from "./repository";
import { CODE_MINUTES, generateCode, hashCode, RESEND_SECONDS, resendIn } from "./verification";

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
  if (typeof typed !== "string") {
    // "Send it again" posts no code, as the first answer does. Within thirty seconds of the last
    // code to the address, that one is still the code to enter.
    const last = await findEmailCode(event.id, email);
    const wait = last ? resendIn(last, now) : 0;
    if (wait > 0) return { error: "codeTooSoon", codeSent: { email, resendIn: wait } };
    return sendCode(event, email, requestHeaders, now);
  }
  const { verdict, triesLeft } = await tryEmailCode(event.id, email, typed, now);
  if (verdict === "ok") return "proven";
  if (verdict === "wrong") return { error: "codeWrong", triesLeft };
  const resent = await sendCode(event, email, requestHeaders, now);
  return resent.error ? resent : { ...resent, error: verdict === "expired" ? "codeExpired" : "codeResent" };
}

// One code to one address, sent at once with sendMail rather than through the outbox, because the
// guest is waiting for it, in the language they are answering in. Each counts against the client's
// mail limit, as every email a request sends does. It has no footer and no stop link: nothing is
// stored for the address but the code's hash until the code matches, so there is nothing to stop.
async function sendCode(event: { id: string; title: string }, email: string, requestHeaders: Headers, now: Date): Promise<SaveRsvpResult> {
  if (!(await consume("mail", requestHeaders)).allowed) return { error: "codeTooFast" };
  const code = generateCode();
  await createEmailCode(event.id, email, hashCode(code), new Date(now.getTime() + CODE_MINUTES * 60_000));
  const t = await getTranslations("Mail.code");
  await sendMail({ to: email, subject: t("subject", { title: event.title }), text: t("body", { title: event.title, code }) });
  return { codeSent: { email, resendIn: RESEND_SECONDS } };
}
