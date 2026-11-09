import { createHash, randomBytes, randomInt } from "node:crypto";
import { SLUG_ALPHABET } from "@/events/slug";
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

// The edit token a device holds a reply by when it holds it only through the invite the reply is
// tied to (invites/device.ts): the invite's token when the reply was saved through the invite, as
// its edit token then is; none when the reply was made before its invite (M6 ticket 08), whose
// own edit token only its guest's edit link and devices carry.
export function editTokenThroughInvite(inviteToken: string, reply: { editTokenHash: string }): string | null {
  return hashEditToken(inviteToken) === reply.editTokenHash ? inviteToken : null;
}

// The mail token is the stop link's secret, at the foot of every email to the guest (spec, "Guest
// mail"): 24 characters of the event link's alphabet, about 143 bits, from the same cryptographic
// source. It is stored as it is, as the mail that carries it is written long after the guest's
// request, and it opens nothing but a page that can blank the email. Never an edit link.
const MAIL_TOKEN_LENGTH = 24;

export function generateMailToken(): string {
  let token = "";
  for (let i = 0; i < MAIL_TOKEN_LENGTH; i++) token += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return token;
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
