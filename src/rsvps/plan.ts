import type { RsvpInput } from "./form";

// When the reply's email was proven by a code (verification.ts), or nothing to change about it.
type Proof = { emailVerifiedAt?: Date | null };

export type RsvpPlan =
  | { replaces: { id: string; token: string }; changes: RsvpInput & Proof & { updatedAt: Date; mailStoppedAt?: null } }
  | { replaces: null; rsvp: RsvpInput & Proof & { eventId: string; repliedAt: Date; updatedAt: Date } };

// Where one answer goes. A guest who comes back — from the device they answered on, or through
// their edit link — changes the RSVP their edit token names instead of adding a second one;
// everyone else is a new guest, even with the same name (CONTEXT.md, "RSVP"). Replacing leaves
// the row, its edit token and the time they first replied alone, so the edit link already in
// their pocket keeps working and the host can see both when they answered and when they changed
// their mind. A guest who stopped email about the event with the stop link takes that back only by
// giving an email again themselves.
//
// An email is proven when the guest has just entered the code sent to it (`proven`); it keeps
// that mark while it stays the same, and loses it once the guest changes or blanks it without a
// code (spec, "Contact details").
export function planRsvp(
  eventId: string,
  input: RsvpInput,
  mine: { id: string; token: string; email: string | null } | undefined,
  now: Date,
  proven = false,
): RsvpPlan {
  if (mine) {
    const proof: Proof = proven ? { emailVerifiedAt: now } : input.email !== undefined && input.email !== mine.email ? { emailVerifiedAt: null } : {};
    const replaces = { id: mine.id, token: mine.token };
    return { replaces, changes: { ...input, ...proof, ...(input.email ? { mailStoppedAt: null } : {}), updatedAt: now } };
  }
  return { replaces: null, rsvp: { ...input, ...(proven ? { emailVerifiedAt: now } : {}), eventId, repliedAt: now, updatedAt: now } };
}

// What a host's edit writes over a guest's RSVP (ticket 04, review): all it carries, except an
// email for a guest who stopped email about the event with the stop link. They asked for no more
// email, and only they can give an address again, by changing their RSVP. An email the host
// changes is not proven (spec, "Contact details"): only a code the guest entered proves one.
export function planHostEdit(edit: RsvpInput, current: { mailStoppedAt: Date | null; email: string | null }): RsvpInput & Proof {
  if (current.mailStoppedAt) return { ...edit, email: undefined };
  return edit.email !== undefined && edit.email !== current.email ? { ...edit, emailVerifiedAt: null } : edit;
}
