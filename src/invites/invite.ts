import { baseUrl } from "@/instance/env";
import { isEmail, isPhone, MAX_NAME } from "@/rsvps/form";
import { generateMailToken } from "@/rsvps/token";

// A personal invite: the personal invite link (CONTEXT.md) a host makes for one named guest, so
// their RSVP is tied to them without asking who they are (spec, "Personal invite links"). Opening
// it fills in the guest's name, and the email the host gave, which counts as proven, and the phone;
// the RSVP saved from it is tied to the invite, and the link then works as that guest's edit link.

// The most an event can have (spec, "Operator limits").
export const MAX_INVITES = 500;

// Whether an event that already has this many invites may have one more, or several more at once:
// a pasted list is made whole or not at all.
export function roomForInvite(made: number, adding = 1): boolean {
  return made + adding <= MAX_INVITES;
}

// The longest letter a host may write to one guest (M6 spec, "Personal letters").
export const MAX_LETTER = 1000;

// What the host's form posts, before any of it is trusted. The letter is blank unless the event
// has personal letters on, when the form offers it.
export type InviteFields = { name: string; email: string; phone: string; letter: string };

// One invite, once trusted: the guest's name, their email and phone when the host gave them, and
// the host's letter to them, empty when there is none (M6 spec, "The invite list").
export type InviteInput = { name: string; email: string | null; phone: string | null; letter: string };

export type InviteError = "nameRequired" | "nameTooLong" | "emailInvalid" | "phoneInvalid" | "letterTooLong";

export type ParsedInvite = { ok: true; invite: InviteInput } | { ok: false; error: InviteError };

// The rules of the host's invite form. The name, the email and the phone become the guest's own
// when they reply, so they are held to the RSVP form's rules: a name of up to 80 characters,
// trimmed, and an email and a phone that are optional, trimmed, and shaped like one
// (rsvps/form.ts).
export function parseInvite(fields: InviteFields): ParsedInvite {
  const name = fields.name.trim();
  if (!name) return { ok: false, error: "nameRequired" };
  if (name.length > MAX_NAME) return { ok: false, error: "nameTooLong" };
  const email = fields.email.trim();
  if (email && !isEmail(email)) return { ok: false, error: "emailInvalid" };
  const phone = fields.phone.trim();
  if (phone && !isPhone(phone)) return { ok: false, error: "phoneInvalid" };
  const letter = parseLetter(fields.letter);
  if (!letter.ok) return letter;
  return { ok: true, invite: { name, email: email || null, phone: phone || null, letter: letter.letter } };
}

// A letter (M6 spec, "Personal letters"): plain text, trimmed, its line breaks kept, of up to
// 1000 characters. A browser posts each line break as two characters, where the field counted one,
// so they are made one again before the letter is measured.
export function parseLetter(typed: string): { ok: true; letter: string } | { ok: false; error: "letterTooLong" } {
  const letter = typed.replace(/\r\n?/g, "\n").trim();
  if (letter.length > MAX_LETTER) return { ok: false, error: "letterTooLong" };
  return { ok: true, letter };
}

export type ParsedInviteLines = { ok: true; invites: InviteInput[] } | { ok: false; line: number; error: InviteError };

// The host's pasted list, "Add several" (M6 spec, "The invite list"): one person per line, as
// `Name, email, phone`, the email and the phone left blank or left out, each line held to the
// form's rules and none with a letter. Blank lines are skipped; anything after the second comma is
// the phone, and is refused as one. The first line that breaks a rule is named, numbered as the
// host sees it, and nobody is made; a list with nobody on it is refused at its first line.
export function parseInviteLines(text: string): ParsedInviteLines {
  const invites: InviteInput[] = [];
  const lines = text.split(/\r\n?|\n/);
  for (const [at, line] of lines.entries()) {
    if (!line.trim()) continue;
    const [name, email = "", ...phone] = line.split(",");
    const parsed = parseInvite({ name, email, phone: phone.join(","), letter: "" });
    if (!parsed.ok) return { ok: false, line: at + 1, error: parsed.error };
    invites.push(parsed.invite);
  }
  if (invites.length === 0) return { ok: false, line: 1, error: "nameRequired" };
  return { ok: true, invites };
}

// How an invite stands, as the host's list shows it: replied once an RSVP was saved through it,
// whatever else; opened once the guest opened the link; otherwise not opened.
export type InviteState = "notOpened" | "opened" | "replied";

export function inviteState(invite: { openedAt: Date | null; rsvpId: string | null }): InviteState {
  if (invite.rsvpId) return "replied";
  return invite.openedAt ? "opened" : "notOpened";
}

// The link's secret, of the mail token's shape (rsvps/token.ts): 24 characters of the event link's
// alphabet, about 143 bits, from a cryptographic source. It is stored as it is, since the host may
// see the link again whenever they ask: it is the guest's key, not a secret from the host. It is
// also the edit token of the RSVP saved through it, whose hash the RSVP keeps as any edit token's.
export function generateInviteToken(): string {
  return generateMailToken();
}

export function inviteUrl(token: string): string {
  return `${baseUrl()}/i/${token}`;
}
