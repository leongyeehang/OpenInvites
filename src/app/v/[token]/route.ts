import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { eventPath } from "@/events/slug";
import { baseUrl } from "@/instance/env";
import { findEventForVoterToken } from "@/polls/repository";
import { voterCookieName } from "@/polls/voter";
import { rsvpCookieOptions } from "@/rsvps/token";

// A voter's private link (M4 ticket 09), as an RSVP's edit link is (/r/[token]): it leaves the
// cookie on this device and hands them the invitation, where their votes are waiting. The token
// never reaches the page's address.
export async function GET(_request: Request, context: RouteContext<"/v/[token]">) {
  const { token } = await context.params;
  const found = await findEventForVoterToken(token);
  if (!found) notFound();
  const response = NextResponse.redirect(new URL(eventPath({ slug: found.slug, customSlug: found.customSlug }), baseUrl()));
  response.cookies.set(voterCookieName(found.eventId), token, rsvpCookieOptions());
  return response;
}
