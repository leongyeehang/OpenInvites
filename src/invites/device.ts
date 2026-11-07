import { cookies } from "next/headers";
import { cache } from "react";
import { authSecret } from "@/instance/env";
import { findRsvpById, type MyRsvp } from "@/rsvps/repository";
import { editTokenThroughInvite, rsvpCookieOptions } from "@/rsvps/token";
import { readPass, passCookieName } from "./pass";
import { findInviteById, findInviteByToken, type Invite } from "./repository";

// The cookie that remembers, on the device that opened a personal invite link, which invite it was
// (app/i/[token]/route.ts). Named after the event, as the RSVP cookie is, so one device can hold
// invites to several events.
export function inviteCookieName(eventId: string): string {
  return `invite_${eventId}`;
}

// The RSVP cookie's, for a year: once the guest replies through it, the cookie stands for their reply
// as the RSVP cookie does (findInvitedRsvpOnThisDevice).
export function inviteCookieOptions() {
  return rsvpCookieOptions();
}

// The invite of the event this device stands for, answered or not, and whether it holds a pass for
// it (M6 spec, "Who is in"). A pass comes first: once a guest has proven their email on this
// device, its invite is who they are. A pass whose invite has been deleted is void, and the device
// falls back to the invite cookie, if any. Nothing once that invite is deleted too. Cached per
// request: the gate, the RSVP the device holds and the invite it may reply through all ask.
export const inviteOnThisDevice = cache(async (eventId: string): Promise<{ invite: Invite; pass: boolean } | undefined> => {
  const jar = await cookies();
  const pass = readPass(jar.get(passCookieName(eventId))?.value, eventId, authSecret(), new Date());
  const passed = pass && (await findInviteById(eventId, pass.inviteId));
  if (passed) return { invite: passed, pass: true };
  const token = jar.get(inviteCookieName(eventId))?.value;
  if (!token) return undefined;
  const found = await findInviteByToken(token);
  return found && found.eventId === eventId ? { invite: found, pass: false } : undefined;
});

// The invite this device stands for, while nobody has replied through it: the guest in front of us
// is then that invite's guest, and replies through it. An invite deleted since, or one already
// answered, is none; the transaction that writes the RSVP asks again under its lock
// (rsvps/repository.ts, saveRsvp).
export async function findInviteOnThisDevice(eventId: string): Promise<Invite | undefined> {
  const found = (await inviteOnThisDevice(eventId))?.invite;
  return found && found.rsvpId === null ? found : undefined;
}

// The RSVP tied to the invite this device stands for, wherever its guest saved it (M3 ticket 08,
// review): it shows the guest their reply, and a form left filled in here changes it rather than
// adding a second. Found by the invite's id, not by its token, as a reply made before its invite
// was keeps an edit token of its own (M6 spec, "Identity on a device that is in"). The device
// holds the reply's edit token only when that is the invite's token, as for a reply saved through
// the invite; for one made before its invite (M6 ticket 08) it holds none, and keeps finding the
// reply through the invite. Nothing once the invite is deleted.
export async function findInvitedRsvpOnThisDevice(eventId: string): Promise<MyRsvp | undefined> {
  const found = (await inviteOnThisDevice(eventId))?.invite;
  if (!found?.rsvpId) return undefined;
  const reply = await findRsvpById(eventId, found.rsvpId);
  return reply && { rsvp: reply, token: editTokenThroughInvite(found.token, reply), inviteToken: found.token };
}
