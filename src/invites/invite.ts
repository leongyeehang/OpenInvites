import { randomInt } from "node:crypto";
import { SLUG_ALPHABET } from "@/events/slug";
import { baseUrl } from "@/instance/env";
import { isEmail, MAX_NAME } from "@/rsvps/form";

// A personal invite link (CONTEXT.md): an event link a host makes for one named guest, so their
// RSVP is tied to them without asking who they are (spec, "Personal invite links"). Opening it fills
// in the guest's name, and the email the host gave, which counts as proven; the RSVP saved from it
// is tied to the invite, and the link then works as that guest's edit link.

// The most an event can have (spec, "Operator limits").
export const MAX_INVITES = 500;

// Whether an event that already has this many invites may have one more.
export function roomForInvite(made: number): boolean {
  return made < MAX_INVITES;
}

// What the host's form posts, before any of it is trusted.
export type InviteFields = { name: string; email: string };

// One invite, once trusted: the guest's name, and their email when the host gave one.
export type InviteInput = { name: string; email: string | null };

export type InviteError = "nameRequired" | "nameTooLong" | "emailInvalid";

export type ParsedInvite = { ok: true; invite: InviteInput } | { ok: false; error: InviteError };

// The rules of the host's invite form. The name and the email become the guest's own when they
// reply, so they are held to the RSVP form's rules: a name of up to 80 characters, trimmed, and an
// email that is optional, trimmed, and shaped like one (rsvps/form.ts).
export function parseInvite(fields: InviteFields): ParsedInvite {
  const name = fields.name.trim();
  if (!name) return { ok: false, error: "nameRequired" };
  if (name.length > MAX_NAME) return { ok: false, error: "nameTooLong" };
  const email = fields.email.trim();
  if (email && !isEmail(email)) return { ok: false, error: "emailInvalid" };
  return { ok: true, invite: { name, email: email || null } };
}

// How an invite stands, as the host's list shows it: replied once an RSVP was saved through it,
// whatever else; opened once the guest opened the link; otherwise not opened.
export type InviteState = "notOpened" | "opened" | "replied";

export function inviteState(invite: { openedAt: Date | null; rsvpId: string | null }): InviteState {
  if (invite.rsvpId) return "replied";
  return invite.openedAt ? "opened" : "notOpened";
}

// The link's secret: 24 characters of the event link's alphabet, about 143 bits, from a
// cryptographic source, as the mail token is (rsvps/token.ts). It is stored as it is, since the host
// may see the link again whenever they ask: it is the guest's key, not a secret from the host. It
// is also the edit token of the RSVP saved through it, whose hash the RSVP keeps as any edit token's.
const TOKEN_LENGTH = 24;

export function generateInviteToken(): string {
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) token += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return token;
}

export function inviteUrl(token: string): string {
  return `${baseUrl()}/i/${token}`;
}
