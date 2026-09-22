import { createHash, randomBytes } from "node:crypto";
import { baseUrl } from "@/instance/env";

// The edit token is the only thing that proves an RSVP is yours (spec, "Events and RSVPs"):
// 24 random bytes from a cryptographic source, written as URL-safe base64. It reaches the guest
// as an edit link and as a cookie on the device they answered from.
export function generateEditToken(): string {
  return randomBytes(24).toString("base64url");
}

// Only the hash is stored, so a copy of the database hands out no edit links. A plain SHA-256 is
// enough where a slow hash is not: the token is random, so there is nothing to guess at.
export function hashEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// The cookie that remembers this guest on this device. Named after the event, so one device can
// hold an RSVP to every event it has answered, and tied to the event's id rather than its link,
// which a host may reset (ticket 14).
export function rsvpCookieName(eventId: string): string {
  return `rsvp_${eventId}`;
}

// A year: long enough to carry a guest from the invitation to the party and back. Secure
// whenever the instance is served over HTTPS, which its public address is the truth about.
export function rsvpCookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl().startsWith("https:"),
  } as const;
}
