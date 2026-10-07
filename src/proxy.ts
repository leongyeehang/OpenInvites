import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/auth/auth";
import { eventLinkExists, findHostEvent } from "@/events/repository";
import { isSlug } from "@/events/slug";
import { findHostInvitation, isOperator } from "@/instance/repository";
import { consume, retryAfter } from "@/rate-limit/rate-limit";
import { findByMailToken, findEventForToken } from "@/rsvps/repository";

// Requests the rate limits count before any route sees them (spec, "Operator configuration").
// Every request under an event link counts against one limit per client, whatever its method:
// the page, its preview card, and its calendar file, whether the slug belongs to an event, has
// been retired, or never existed, so that event links cannot be found by trying them. A host
// invitation link counts as signing up; an edit link or a stop link counts as nothing. A refused
// request gets a page that says so, as 429 with Retry-After.
//
// A server action (a POST naming one in Next-Action) is let through: it is the page's own form
// (a guest's RSVP, the host's Design drawer), whose answer must be the action's own, with its
// own limit and message. Next.js answers one naming no action "not found", and hands one that
// belongs to another page to that page, without drawing this one either way; one of the page's
// own whose answer draws the page again is counted by the page (e/[slug]/page.tsx).
//
// Then a page that is not there for this visitor, or an edit link, a stop link or a host invitation
// link that was never made, is answered with the not-found page, drawn on the server as it is for
// an address nothing lives at (below, notFoundHere).
export async function proxy(request: NextRequest) {
  if (request.method === "POST" && request.headers.has("next-action")) return;
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/e/") || pathname.startsWith("/host-invitation/")) {
    const verdict = await consume(pathname.startsWith("/host-invitation/") ? "signUp" : "eventPage", request.headers);
    if (!verdict.allowed) return NextResponse.rewrite(new URL("/too-fast", request.url), { status: 429, headers: retryAfter(verdict) });
  }
  if (isDocumentRequest(request) && (await notFoundHere(pathname, request.headers))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
}

export const config = { matcher: ["/e/:path*", "/r/:path*", "/m/:path*", "/host-invitation/:path*", "/events/:path*", "/instance"] };

// A page's notFound() cannot be drawn on the server. React's server renderer has no error
// boundaries, so a page that throws it while the document is being drawn takes the whole
// document down, and Next.js sends an empty shell (<html id="__next_error__">, with no lang and no
// content) for the browser to build the not-found page in. An address nothing lives at is drawn
// whole, as Next.js's own /_not-found page. So each page that ends in notFound() is asked here, the
// way it asks itself, and a visitor it is not there for is sent /_not-found, drawn whole, in their
// language, with 404. A route handler (an edit link, a host invitation link) is asked the same way:
// its notFound() has no page to draw at all and sends an empty body. The pages and the handlers
// keep their own notFound(), which is what a visitor moving between pages in the browser meets
// (their not-found page is drawn in the browser anyway) and what a request this lets through meets.
async function notFoundHere(pathname: string, headers: Headers): Promise<boolean> {
  // An event link that never existed; one its host has reset has a page of its own (e/[slug]).
  const eventLink = pathname.match(/^\/e\/([^/]+)$/);
  if (eventLink) {
    const slug = decoded(eventLink[1]);
    return !isSlug(slug) || !(await eventLinkExists(slug));
  }
  // An edit link no RSVP has (r/[token]).
  const editLink = pathname.match(/^\/r\/([^/]+)$/);
  if (editLink) return !(await findEventForToken(decoded(editLink[1])));
  // A stop link, at the foot of an email to a guest, that no RSVP has (m/[token]).
  const stopLink = pathname.match(/^\/m\/([^/]+)$/);
  if (stopLink) return !(await findByMailToken(decoded(stopLink[1])));
  // A host invitation link that was never made (host-invitation/[token]); one that is used, revoked,
  // or expired is sent to sign-up, which says so.
  const invitationLink = pathname.match(/^\/host-invitation\/([^/]+)$/);
  if (invitationLink) return !(await findHostInvitation(decoded(invitationLink[1])));
  // Another host's event, or none, for a signed-in host ((host)/events/[id], share, guests), which
  // /events/new/share and /events/new/guests are too: only /events/new is a page of its own. A
  // visitor who is not signed in is sent to sign in by the page.
  const hostEvent = pathname.match(/^\/events\/([^/]+)(?:\/share|\/guests)?$/);
  if (hostEvent && pathname !== "/events/new") {
    const session = await getAuth().api.getSession({ headers });
    return session !== null && !(await findHostEvent(session.user.id, decoded(hostEvent[1])));
  }
  // The instance settings, for anyone but the operator (auth/session.ts, requireOperator).
  if (pathname === "/instance") {
    const session = await getAuth().api.getSession({ headers });
    return session === null || !(await isOperator(session.user.id));
  }
  return false;
}

// A segment of the path as the page is given it; one that does not decode is itself.
function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// The browser asking for a page to show, rather than the app asking for a page's data as it moves
// between pages (the RSC header), which it draws itself.
function isDocumentRequest(request: NextRequest) {
  return (request.method === "GET" || request.method === "HEAD") && !request.headers.has("rsc");
}
