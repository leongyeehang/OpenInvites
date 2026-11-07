import { cookies } from "next/headers";
import { cache } from "react";
import { authSecret } from "@/instance/env";
import { findRsvpById, type MyRsvp } from "@/rsvps/repository";
import { editTokenThroughInvite, rsvpCookieOptions } from "@/rsvps/token";
import { standsFor } from "./access";
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

// The invite of the event whose pass this device holds, while that invite still exists: a pass
// whose invite has been deleted is void. Cached per request.
const invitePassed = cache(async (eventId: string): Promise<Invite | undefined> => {
  const pass = readPass((await cookies()).get(passCookieName(eventId))?.value, eventId, authSecret(), new Date());
  return pass && (await findInviteById(eventId, pass.inviteId));
});

// The invite of the event whose personal link this device opened last (app/i/[token]/route.ts),
// while it still exists. Cached per request.
const inviteByCookie = cache(async (eventId: string): Promise<Invite | undefined> => {
  const token = (await cookies()).get(inviteCookieName(eventId))?.value;
  if (!token) return undefined;
  const found = await findInviteByToken(token);
  return found && found.eventId === eventId ? found : undefined;
});

// The invite of the event this device holds by its own cookies, answered or not, and whether it
// holds a pass for it (M6 spec, "Who is in"). A pass comes first: once a guest has proven their
// email on this device, its invite is who they are. A pass whose invite has been deleted is void,
// and the device falls back to the invite cookie, if any. Nothing once that invite is deleted too.
// Cached per request: the RSVP the device holds and the invite it may reply through both ask.
export const inviteOnThisDevice = cache(async (eventId: string): Promise<{ invite: Invite; pass: boolean } | undefined> => {
  const passed = await invitePassed(eventId);
  if (passed) return { invite: passed, pass: true };
  const cookie = await inviteByCookie(eventId);
  return cookie && { invite: cookie, pass: false };
});

// The invite the device stands for, and whether it holds a pass for it: its pass's; else the one
// the reply it holds (`mine`) is tied to; else its invite cookie's (invites/access.ts, standsFor).
// The reply comes before the cookie as the stronger claim (M6 final review): a guest who replied,
// and then opened a link someone forwarded them, the link of an invite with an email, is still the
// guest who replied, and is let in as they were. The gate asks it who is in on an invite-only event
// (invites/gate.ts); the event page asks it whose letter to show, on any event with personal
// letters on (M6 ticket 09).
export async function deviceInvite(eventId: string, mine: MyRsvp | undefined): Promise<{ invite: Invite | undefined; pass: boolean }> {
  // Each looked up only when what comes before it found nothing.
  const passed = await invitePassed(eventId);
  const replied = passed || !mine?.rsvp.inviteId ? undefined : await findInviteById(eventId, mine.rsvp.inviteId);
  const cookie = passed || replied ? undefined : await inviteByCookie(eventId);
  return standsFor({ passed, replied, cookie });
}

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
