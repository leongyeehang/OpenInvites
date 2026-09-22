import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { baseUrl } from "@/instance/env";
import { findEventForToken } from "@/rsvps/repository";
import { rsvpCookieName, rsvpCookieOptions } from "@/rsvps/token";

// The edit link a guest is given when they answer. It works on any device: it leaves this
// device's cookie behind and then hands the guest their invitation, where their RSVP is
// waiting. The token itself never reaches the address bar of the page, so a screenshot of the
// invitation gives nothing away.
export async function GET(_request: Request, context: RouteContext<"/r/[token]">) {
  const { token } = await context.params;
  const found = await findEventForToken(token);
  if (!found) notFound();

  const response = NextResponse.redirect(new URL(`/e/${found.slug}`, baseUrl()));
  response.cookies.set(rsvpCookieName(found.eventId), token, rsvpCookieOptions());
  return response;
}
