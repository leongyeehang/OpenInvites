import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { eventPath } from "@/events/slug";
import { authSecret, baseUrl } from "@/instance/env";
import { inviteCookieName, inviteCookieOptions } from "@/invites/device";
import { passCookieName, passExpiresAt, signPass } from "@/invites/pass";
import { findInviteByToken, markInviteOpened } from "@/invites/repository";
import { rsvpCookieOptions } from "@/rsvps/token";

// A personal invite link (spec, "Personal invite links"). The first opening is what the host's list
// shows as Opened. It leaves a cookie naming the invite: until the guest replies through it, the
// event page fills in their name and email, and their reply is tied to the invite
// (rsvps/actions.ts); once they have, the device holds that reply by the invite (invites/device.ts),
// so the link is their edit link on any device. On an invite-only event, the link of an invite with
// no email is all its guest has to prove, so it also leaves a pass (M6 spec, "How a pass is
// granted"); one with an email leaves none, and the locked page asks for a code sent to it. Either
// way the guest lands on the event page, at its custom link when it has one, which shows what it
// shows them in the event's state; the token never reaches its address bar. A token no invite has,
// deleted or never made, is not found.
export async function GET(_request: Request, context: RouteContext<"/i/[token]">) {
  const { token } = await context.params;
  const found = await findInviteByToken(token);
  if (!found) notFound();
  const now = new Date();
  if (!found.openedAt) await markInviteOpened(found.id, now);

  const response = NextResponse.redirect(new URL(eventPath(found), baseUrl()));
  response.cookies.set(inviteCookieName(found.eventId), token, inviteCookieOptions());
  if (found.inviteOnly && !found.email) {
    const pass = signPass({ eventId: found.eventId, inviteId: found.id, expiresAt: passExpiresAt(now) }, authSecret());
    response.cookies.set(passCookieName(found.eventId), pass, rsvpCookieOptions());
  }
  return response;
}
