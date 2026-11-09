import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "@/lib/uuid";

// The pass (M6 spec, "Who is in"): the mark on a guest's device that they are in on an invite-only
// event, given once they prove their invite's email with a code, or open the personal invite link
// of an invite with no email. A cookie, never shown to anyone and never sent by mail, holding the
// invite's id, when it expires, and a signature over both and the event's id with AUTH_SECRET, so
// it is kept in no table and cannot be made up, moved to another event, or kept past its year. It
// holds only while its invite does: the device looks the invite up each time (invites/device.ts).

// A year, as the RSVP cookie lasts (rsvps/token.ts).
export const PASS_DAYS = 365;

// When a pass given now expires.
export function passExpiresAt(now: Date): Date {
  return new Date(now.getTime() + PASS_DAYS * 24 * 60 * 60 * 1000);
}

// Named after the event, as the RSVP cookie is, so one device can hold passes to several events.
export function passCookieName(eventId: string): string {
  return `pass_${eventId}`;
}

// Signed for its purpose: other features key their signatures from AUTH_SECRET too, so what is
// signed starts with what it is for, and no signature made for anything else passes for a pass.
function signature(eventId: string, inviteId: string, expires: number, secret: string): string {
  return createHmac("sha256", secret).update(`pass:${eventId}:${inviteId}:${expires}`).digest("hex");
}

// `inviteId.expiresMs.hmac`.
export function signPass({ eventId, inviteId, expiresAt }: { eventId: string; inviteId: string; expiresAt: Date }, secret: string): string {
  const expires = expiresAt.getTime();
  return `${inviteId}.${expires}.${signature(eventId, inviteId, expires, secret)}`;
}

// The invite a pass names, while it is this event's, unexpired and signed with this secret;
// otherwise nothing. The signatures are compared in constant time.
export function readPass(value: string | undefined, eventId: string, secret: string, now: Date): { inviteId: string } | undefined {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 3) return undefined;
  const [inviteId, expiresText, given] = parts;
  if (!isUuid(inviteId) || !/^\d{1,15}$/.test(expiresText)) return undefined;
  const expires = Number(expiresText);
  if (expires <= now.getTime()) return undefined;
  const expected = Buffer.from(signature(eventId, inviteId, expires, secret));
  const received = Buffer.from(given);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return undefined;
  return { inviteId };
}
