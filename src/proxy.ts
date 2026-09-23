import { NextResponse, type NextRequest } from "next/server";
import { consume, retryAfter } from "@/rate-limit/rate-limit";

// Requests the rate limits count before any route sees them (spec, "Operator configuration").
// Every request under an event link counts against one limit per client, whatever its method:
// the page, its preview card, and its calendar file, whether the slug belongs to an event, has
// been retired, or never existed, so that event links cannot be found by trying them. A host
// invitation link counts as signing up. A refused request gets a page that says so, as 429 with
// Retry-After.
//
// A server action (a POST naming one in Next-Action) is let through: it is the page's own form
// (a guest's RSVP, the host's Design drawer), whose answer must be the action's own, with its
// own limit and message. Next.js answers one naming no action "not found", and hands one that
// belongs to another page to that page, without drawing this one either way; one of the page's
// own whose answer draws the page again is counted by the page (e/[slug]/page.tsx).
export async function proxy(request: NextRequest) {
  if (request.method === "POST" && request.headers.has("next-action")) return;
  const verdict = await consume(request.nextUrl.pathname.startsWith("/host-invitation/") ? "signUp" : "eventPage", request.headers);
  if (verdict.allowed) return;
  return NextResponse.rewrite(new URL("/too-fast", request.url), { status: 429, headers: retryAfter(verdict) });
}

export const config = { matcher: ["/e/:path*", "/host-invitation/:path*"] };
