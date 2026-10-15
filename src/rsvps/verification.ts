import { createHmac, randomInt } from "node:crypto";
import type { ContactField } from "./form";

// Proving a guest's email (spec, "Contact details"): when the host asks for it, the email on a
// reply is taken only once the guest has entered a six-digit code sent to it. A code lasts ten
// minutes and five wrong tries; another may be sent thirty seconds after the last.
export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 30;

const CODE_DIGITS = 6;

// Six digits from a cryptographic source, every one equally likely, a leading zero kept.
export function generateCode(): string {
  return String(randomInt(10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

// Only this is stored: an HMAC-SHA256 keyed by the instance's secret (AUTH_SECRET), passed in so
// the rule stays pure. A plain hash of six digits is undone by trying the million there are, so a
// copy of the database alone would hand out every live code; keyed, it hands out none. A copy taken
// with the secret can still be tried, for the ten minutes a code lasts; nothing here guards that.
export function hashCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("hex");
}

// Whether this save of a reply waits for a code. Only when the host checks the email, the form
// asks for one, the instance can send mail (without it the check is kept but does nothing), and
// the guest gave an email that their reply does not already hold proven: a returning guest who
// keeps a proven email is not asked again, and one who changes it is.
export function needsCode({
  verifyEmail,
  emailField,
  mailConfigured,
  email,
  current,
}: {
  verifyEmail: boolean;
  emailField: ContactField;
  mailConfigured: boolean;
  email: string | null | undefined;
  current: { email: string | null; emailVerifiedAt: Date | null } | undefined;
}): boolean {
  if (!verifyEmail || emailField === "none" || !mailConfigured || !email) return false;
  return !current || current.email !== email || current.emailVerifiedAt === null;
}

export type CodeVerdict = "ok" | "wrong" | "expired" | "tooManyAttempts";

// What a code the guest typed is worth against the one sent to their address, hashed with the
// same secret. A code that has run out of time or of tries is dead, whatever was typed, and one
// out of both is expired: the guest is sent a new one.
export function codeVerdict(sent: { codeHash: string; expiresAt: Date; attempts: number }, typed: string, now: Date, secret: string): CodeVerdict {
  if (now >= sent.expiresAt) return "expired";
  if (sent.attempts >= MAX_ATTEMPTS) return "tooManyAttempts";
  return hashCode(typed.trim(), secret) === sent.codeHash ? "ok" : "wrong";
}

// How many seconds until another code may be sent to the same address: none once thirty have
// passed since the last.
export function resendIn(sent: { createdAt: Date }, now: Date): number {
  return Math.max(0, Math.ceil(RESEND_SECONDS - (now.getTime() - sent.createdAt.getTime()) / 1000));
}

// How long a guest refused a new code is told to wait, once the database has said the last code to
// the address went less than thirty seconds ago (createEmailCode): what is left of them, at least
// a second whatever this clock says; all thirty when that code has gone meanwhile.
export function resendWait(last: { createdAt: Date } | undefined, now: Date): number {
  return last ? Math.max(1, resendIn(last, now)) : RESEND_SECONDS;
}
