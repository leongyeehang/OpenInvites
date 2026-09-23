import { NextResponse, type NextRequest } from "next/server";
import { consume, retryAfter } from "@/rate-limit/rate-limit";

// Page requests the rate limits count before any route sees them (spec, "Operator
// configuration"). Everything under an event link counts against one limit per client: the page,
// its preview card, and its calendar file, whether the slug belongs to an event, has been retired,
// or never existed, so that event links cannot be found by trying them. A host invitation link
// counts as signing up. A refused request gets a page that says so, as 429 with Retry-After.
// Server actions posted to an event page (a guest's RSVP, the host's Design drawer) are not page
// requests: an RSVP has its own limit (rsvps/actions.ts).
export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const verdict = await consume(request.nextUrl.pathname.startsWith("/host-invitation/") ? "signUp" : "eventPage", request.headers);
  if (verdict.allowed) return;
  return NextResponse.rewrite(new URL("/too-fast", request.url), { status: 429, headers: retryAfter(verdict) });
}

export const config = { matcher: ["/e/:path*", "/host-invitation/:path*"] };
