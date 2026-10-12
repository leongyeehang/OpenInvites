import type { Approval } from "./admission";
import type { SavedStatus } from "./form";

// What deciding who is emailed needs of an RSVP.
export type Addressable = { status: SavedStatus; approval: Approval; email: string | null; mailToken: string | null };

// The guests of an event who are emailed, of those whose RSVP is let through: the ones whose status
// is one of those given and who gave an email, in the order given. Every email to a guest ends
// with its stop link, so a guest is emailed only when their RSVP has a mail token, which every RSVP
// with an email has: saveRsvp makes one, and migration 0015 gave one to every RSVP that already had
// an email.
export function addressed<T extends Addressable>(
  rsvps: T[],
  audience: readonly SavedStatus[],
  approvals: readonly Approval[],
): (T & { email: string; mailToken: string })[] {
  return rsvps.filter((each): each is T & { email: string; mailToken: string } => {
    return audience.includes(each.status) && approvals.includes(each.approval) && !!each.email && !!each.mailToken;
  });
}

// Who of an event's guests is emailed (spec, "Guest mail"): the guests the host has approved whose
// status is one of those given and who gave an email. An announcement goes to the statuses the
// host ticked (spec, "Announcements"), a reminder to Going or Maybe, a promotion to the guest it
// made Going. A reply waiting for the host's approval, or declined by them, gets none of these
// (spec, "Approval"); the cancellation notice is the one email that reaches a pending reply
// (cancellation.ts).
export function recipients<T extends Addressable>(rsvps: T[], audience: readonly SavedStatus[]): (T & { email: string; mailToken: string })[] {
  return addressed(rsvps, audience, ["approved"]);
}
