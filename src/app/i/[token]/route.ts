import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { eventPath } from "@/events/slug";
import { baseUrl } from "@/instance/env";
import { inviteCookieName, inviteCookieOptions } from "@/invites/device";
import { findInviteByToken, markInviteOpened } from "@/invites/repository";
import { rsvpCookieName, rsvpCookieOptions } from "@/rsvps/token";

// A personal invite link (spec, "Personal invite links"). The first opening is what the host's list
// shows as Opened. Once the guest has replied through it, it is their edit link: it leaves the RSVP
// cookie behind, its token being their RSVP's edit token, as /r/ does, on any device. Until then it
// leaves a cookie naming the invite, so the event page fills in the guest's name and email, and their
// reply is tied to the invite (rsvps/actions.ts). Either way the guest lands on the event page, at
// its custom link when it has one, which shows what it shows anyone in the event's state; the token
// never reaches its address bar. A token no invite has, deleted or never made, is not found.
export async function GET(_request: Request, context: RouteContext<"/i/[token]">) {
  const { token } = await context.params;
  const found = await findInviteByToken(token);
  if (!found) notFound();
  if (!found.openedAt) await markInviteOpened(found.id, new Date());

  const response = NextResponse.redirect(new URL(eventPath(found), baseUrl()));
  if (found.rsvpId) response.cookies.set(rsvpCookieName(found.eventId), token, rsvpCookieOptions());
  else response.cookies.set(inviteCookieName(found.eventId), token, inviteCookieOptions());
  return response;
}
