import { cookies } from "next/headers";
import { baseUrl } from "@/instance/env";
import type { AnswerError } from "@/questions/answers";
import type { RsvpFormError, RsvpStatus } from "./form";
import { findRsvpByToken, type MyRsvp } from "./repository";
import { rsvpCookieName } from "./token";

// What the guest is shown after answering: their own answer, and the private link that changes
// it from anywhere. This is the only shape of an RSVP a guest ever receives.
export type GuestRsvp = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
  email: string | null;
  phone: string | null;
  editLink: string;
};

// Why an answer was refused. The guest's own browser turns it into a sentence, and uses it to
// send them back to the step holding the field that needs them. Too fast is the rate limit; limit reached is the operator's cap on replies per event.
export type RsvpRefusal = RsvpFormError | AnswerError | CodeRefusal | "closed" | "limitReached" | "tooFast";

// Why the code step stopped short of saving the reply (email-code.ts): a wrong code; a dead one,
// expired or out of tries, for which a new one was sent; or no code sent, because one went to the
// address moments ago or the client has caused as much mail as the instance allows.
export type CodeRefusal = "codeWrong" | "codeExpired" | "codeResent" | "codeTooSoon" | "codeTooFast";

// What saving an answer did: saved it; or sent a code to the email it gave (or one went there just
// now), which the guest enters before it is saved, with how long until another can be sent; or
// refused it, with how many tries the code has left when it was the wrong one.
export type SaveRsvpResult = {
  error?: RsvpRefusal;
  saved?: GuestRsvp;
  codeSent?: { email: string; resendIn: number };
  triesLeft?: number;
};

export function guestRsvp({ rsvp, token }: MyRsvp): GuestRsvp {
  const { status, name, plusOnes, plusOneNames, email, phone } = rsvp;
  return { status, name, plusOnes, plusOneNames, email, phone, editLink: `${baseUrl()}/r/${token}` };
}

// The RSVP the guest in front of us holds on this device. The cookie carries their edit token,
// so coming back to the event link finds their answer, and an edit link opened on another device
// leaves the same cookie behind (see the /r/[token] route).
export async function findRsvpOnThisDevice(eventId: string): Promise<MyRsvp | undefined> {
  const token = (await cookies()).get(rsvpCookieName(eventId))?.value;
  if (!token) return undefined;
  const found = await findRsvpByToken(eventId, token);
  return found && { rsvp: found, token };
}
