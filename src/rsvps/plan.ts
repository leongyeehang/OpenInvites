import type { RsvpInput } from "./form";

export type RsvpPlan =
  | { replaces: { id: string; token: string }; changes: RsvpInput & { updatedAt: Date } }
  | { replaces: null; rsvp: RsvpInput & { eventId: string; repliedAt: Date; updatedAt: Date } };

// Where one answer goes. A guest who comes back — from the device they answered on, or through
// their edit link — changes the RSVP their edit token names instead of adding a second one;
// everyone else is a new guest, even with the same name (CONTEXT.md, "RSVP"). Replacing leaves
// the row, its edit token and the time they first replied alone, so the edit link already in
// their pocket keeps working and the host can see both when they answered and when they changed
// their mind.
export function planRsvp(
  eventId: string,
  input: RsvpInput,
  mine: { id: string; token: string } | undefined,
  now: Date,
): RsvpPlan {
  if (mine) return { replaces: mine, changes: { ...input, updatedAt: now } };
  return { replaces: null, rsvp: { ...input, eventId, repliedAt: now, updatedAt: now } };
}
