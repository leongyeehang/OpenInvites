import { cookies } from "next/headers";
import { baseUrl } from "@/instance/env";
import { inviteUrl } from "@/invites/invite";
import type { AnswerError } from "@/questions/answers";
import type { Approval } from "./admission";
import type { RsvpFormError, SavedStatus } from "./form";
import { findRsvpByToken, type MyRsvp } from "./repository";
import { rsvpCookieName } from "./token";

// What the guest is shown after answering: their own answer, and the private link that changes
// it from anywhere. This is the only shape of an RSVP a guest ever receives. A guest on the
// waitlist is told their place in it, the first being 1 (repository.ts, findWaitlistPosition), and
// every guest whether the host has approved their reply, is yet to, or declined it.
export type GuestRsvp = {
  status: SavedStatus;
  approval: Approval;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
  email: string | null;
  phone: string | null;
  editLink: string;
  waitlistPosition: number | null;
};

// Why an answer was refused. The guest's own browser turns it into a sentence, and uses it to
// send them back to the step holding the field that needs them. Too fast is the rate limit; limit
// reached is the operator's cap on replies per event; capacity full is a Going guest bringing more
// people than the event has room for (admission.ts).
export type RsvpRefusal = RsvpFormError | AnswerError | CodeRefusal | "closed" | "limitReached" | "capacityFull" | "tooFast";

// Why the code step stopped short of saving the reply (email-code.ts): a wrong code; a dead one,
// expired or out of tries, for which a new one was sent; or no code sent, because one went to the
// address moments ago or the client has caused as much mail as the instance allows.
export type CodeRefusal = "codeWrong" | "codeExpired" | "codeResent" | "codeTooSoon" | "codeTooFast";

// What saving an answer did: saved it; or sent a code to the email it gave (or one went there just
// now), which the guest enters before it is saved, with how long until another can be sent; or
// refused it, with how many tries the code has left when it was the wrong one, or how many places
// are left when the party was too big.
export type SaveRsvpResult = {
  error?: RsvpRefusal;
  saved?: GuestRsvp;
  codeSent?: { email: string; resendIn: number };
  triesLeft?: number;
  placesLeft?: number;
};

// The edit link of an RSVP saved through a personal invite is the invite link, whose token is its
// edit token (spec, "Personal invite links"); once the host deletes the invite, the RSVP's own
// /r/ link opens it, with the same token.
export function guestRsvp({ rsvp, token }: MyRsvp, waitlistPosition: number | null): GuestRsvp {
  const { status, approval, name, plusOnes, plusOneNames, email, phone } = rsvp;
  const editLink = rsvp.inviteId ? inviteUrl(token) : `${baseUrl()}/r/${token}`;
  return { status, approval, name, plusOnes, plusOneNames, email, phone, editLink, waitlistPosition };
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
