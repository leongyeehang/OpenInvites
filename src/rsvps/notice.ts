import type { SavedStatus } from "./form";

// What the hosts are told about a change to one RSVP (spec, "Host notifications").
export type RsvpNotice = "replied" | "changed" | "removed" | "waitlisted";

// Which saves are worth an email to the hosts, from the RSVP status before and after, null where
// there was no RSVP: a guest's first answer, a change of status, and a removal. A reply that lands
// on the waitlist, first time or not, says so (spec, "Capacity and the waitlist"). An edit that
// keeps the status (a corrected name, a plus-one more or fewer, other answers) tells them nothing.
export function rsvpNotice(before: SavedStatus | null, after: SavedStatus | null): RsvpNotice | null {
  if (after === "waitlisted" && before !== "waitlisted") return "waitlisted";
  if (before === null) return after === null ? null : "replied";
  if (after === null) return "removed";
  return before === after ? null : "changed";
}
