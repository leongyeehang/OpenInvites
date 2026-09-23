import { createHash, randomBytes } from "node:crypto";
import { baseUrl } from "@/instance/env";

// The link is the credential (CONTEXT.md, "Host invitation"): 24 random bytes from a
// cryptographic source, written as URL-safe base64, as an RSVP's edit token is.
export function generateHostInvitationToken(): string {
  return randomBytes(24).toString("base64url");
}

// Only the hash is stored. A plain SHA-256 is enough: the token is random, so there is nothing to
// guess at.
export function hashHostInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hostInvitationLink(token: string): string {
  return `${baseUrl()}/host-invitation/${token}`;
}

// Opening the link leaves its token in this cookie, which the sign-up reads wherever it happens:
// in the sign-up form, or on the way back from Google or GitHub, which the address bar does not
// survive. Lax, so it rides along on that return; an hour, long enough to finish signing up.
export const HOST_INVITATION_COOKIE = "host_invitation";

export function hostInvitationCookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60,
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl().startsWith("https:"),
  } as const;
}
