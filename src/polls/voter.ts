import { cookies } from "next/headers";
import { baseUrl } from "@/instance/env";
import { findVoterByToken, type Voter } from "./repository";

// The cookie that remembers a voter on this device, one per event, as an RSVP's does
// (rsvps/token.ts). Its value is the voter's edit token.
export function voterCookieName(eventId: string): string {
  return `vote_${eventId}`;
}

// The voter this device holds for the event, with their private link, or nobody.
export async function findVoterOnThisDevice(eventId: string): Promise<(Voter & { editLink: string }) | undefined> {
  const token = (await cookies()).get(voterCookieName(eventId))?.value;
  if (!token) return undefined;
  const voter = await findVoterByToken(eventId, token);
  return voter && { ...voter, editLink: `${baseUrl()}/v/${token}` };
}
