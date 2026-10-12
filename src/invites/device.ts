import { cookies } from "next/headers";
import { rsvpCookieOptions } from "@/rsvps/token";
import { findInviteByToken, type Invite } from "./repository";

// The cookie that remembers, on the device that opened a personal invite link, which invite it was,
// until the guest replies through it (app/i/[token]/route.ts). Named after the event, as the RSVP
// cookie is, so one device can hold invites to several events.
export function inviteCookieName(eventId: string): string {
  return `invite_${eventId}`;
}

// The RSVP cookie's, for thirty days: long enough to come back and reply.
export function inviteCookieOptions() {
  return { ...rsvpCookieOptions(), maxAge: 60 * 60 * 24 * 30 };
}

// The invite this device opened for the event, while nobody has replied through it: the guest in
// front of us is then that invite's guest, and replies through it. An invite deleted since, or one
// already answered, is none; the transaction that writes the RSVP asks again under its lock
// (rsvps/repository.ts, saveRsvp).
export async function findInviteOnThisDevice(eventId: string): Promise<Invite | undefined> {
  const token = (await cookies()).get(inviteCookieName(eventId))?.value;
  if (!token) return undefined;
  const found = await findInviteByToken(token);
  return found && found.eventId === eventId && found.rsvpId === null ? found : undefined;
}
