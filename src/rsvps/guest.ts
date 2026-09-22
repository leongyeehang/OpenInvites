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
  editLink: string;
};

// Why an answer was refused. The guest's own browser turns it into a sentence, and uses it to
// send them back to the step holding the field that needs them.
export type RsvpRefusal = RsvpFormError | AnswerError | "closed";

export type SaveRsvpResult = { error?: RsvpRefusal; saved?: GuestRsvp };

export function guestRsvp({ rsvp, token }: MyRsvp): GuestRsvp {
  const { status, name, plusOnes, plusOneNames, email } = rsvp;
  return { status, name, plusOnes, plusOneNames, email, editLink: `${baseUrl()}/r/${token}` };
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
