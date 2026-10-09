import type { RsvpInput } from "./form";

export type RsvpPlan =
  | { replaces: { id: string; token: string }; changes: RsvpInput & { updatedAt: Date; mailStoppedAt?: null } }
  | { replaces: null; rsvp: RsvpInput & { eventId: string; repliedAt: Date; updatedAt: Date } };

// Where one answer goes. A guest who comes back — from the device they answered on, or through
// their edit link — changes the RSVP their edit token names instead of adding a second one;
// everyone else is a new guest, even with the same name (CONTEXT.md, "RSVP"). Replacing leaves
// the row, its edit token and the time they first replied alone, so the edit link already in
// their pocket keeps working and the host can see both when they answered and when they changed
// their mind. A guest who stopped email about the event with the stop link takes that back only by
// giving an email again themselves.
export function planRsvp(
  eventId: string,
  input: RsvpInput,
  mine: { id: string; token: string } | undefined,
  now: Date,
): RsvpPlan {
  if (mine) return { replaces: mine, changes: { ...input, ...(input.email ? { mailStoppedAt: null } : {}), updatedAt: now } };
  return { replaces: null, rsvp: { ...input, eventId, repliedAt: now, updatedAt: now } };
}

// What a host's edit writes over a guest's RSVP (ticket 04, review): all it carries, except an
// email for a guest who stopped email about the event with the stop link. They asked for no more
// email, and only they can give an address again, by changing their RSVP.
export function planHostEdit(edit: RsvpInput, current: { mailStoppedAt: Date | null }): RsvpInput {
  return current.mailStoppedAt ? { ...edit, email: undefined } : edit;
}
