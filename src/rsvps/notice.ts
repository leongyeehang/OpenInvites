import type { Approval } from "./admission";
import type { SavedStatus } from "./form";

// What the hosts are told about a change to one RSVP (spec, "Host notifications").
export type RsvpNotice = "replied" | "changed" | "removed" | "waitlisted" | "pending" | "pendingChanged" | "declinedChanged";

// An RSVP as the notice reads it: what it says, and whether the host has approved it.
type Noted = { status: SavedStatus; approval: Approval };

// Which saves are worth an email to the hosts, from the RSVP before and after, null where there
// was no RSVP: a guest's first answer, a change of status, and a removal. An answer waiting for
// the hosts' approval says so, first time or changed, and a declined one that changes says it is
// still declined, so a change never reads as the guest being on the list (spec, "Approval"; ticket
// 07, review); and a reply that lands on the waitlist, first time or not, says that (spec,
// "Capacity and the waitlist"). An edit that keeps the status (a corrected name, a plus-one more or
// fewer, other answers) tells them nothing.
export function rsvpNotice(before: Noted | null, after: Noted | null): RsvpNotice | null {
  if (before === null && after?.approval === "pending") return "pending";
  if (after?.status === "waitlisted" && before?.status !== "waitlisted") return "waitlisted";
  if (before === null) return after === null ? null : "replied";
  if (after === null) return "removed";
  if (before.status === after.status) return null;
  return after.approval === "pending" ? "pendingChanged" : after.approval === "declined" ? "declinedChanged" : "changed";
}
