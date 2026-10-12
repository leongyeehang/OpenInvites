import type { Approval } from "./admission";
import type { SavedStatus } from "./form";

// What one status contributes to one event, as the database groups the RSVPs, with whether the
// host has approved them.
export type StatusTally = { status: SavedStatus; approval: Approval; rsvps: number; plusOnes: number };

// How an event's replies read: how many said each thing, how many wait for a place, how many wait
// for the host's approval and how many the host declined, and how many people to expect.
export type RsvpCounts = { going: number; maybe: number; cant: number; waitlisted: number; pending: number; declined: number; headcount: number };

export const NO_RSVPS: RsvpCounts = { going: 0, maybe: 0, cant: 0, waitlisted: 0, pending: 0, declined: 0, headcount: 0 };

// Headcount is every Going guest plus their plus-ones. Maybe is never counted, however many
// people a maybe would bring (CONTEXT.md, "Headcount"), and nor is anyone on the waitlist. A reply
// waiting for the host's approval, or declined by them, is counted under that alone, whatever it
// says: nobody it would bring is expected (spec, "Approval").
export function countRsvps(tallies: StatusTally[]): RsvpCounts {
  const counts = { ...NO_RSVPS };
  for (const tally of tallies) {
    if (tally.approval !== "approved") {
      counts[tally.approval] += tally.rsvps;
      continue;
    }
    counts[tally.status] += tally.rsvps;
    if (tally.status === "going") counts.headcount += tally.rsvps + tally.plusOnes;
  }
  return counts;
}

// One RSVP is a tally of one, so a list loaded from the database counts by exactly the rule a
// grouped query does.
export function asTally(rsvp: { status: SavedStatus; approval: Approval; plusOnes: number }): StatusTally {
  return { status: rsvp.status, approval: rsvp.approval, rsvps: 1, plusOnes: rsvp.plusOnes };
}

// A section of the host's guest list: the replies waiting for their approval, those the host
// declined, or the approved replies of one status.
export type GuestGroup = SavedStatus | Exclude<Approval, "approved">;

// The order of the host's guest list (spec, "Events, guests and the page"): who is waiting for the
// host's word, who is coming, who is waiting for a place, then the RSVP buttons' order, and last
// who the host declined.
const GROUPS: GuestGroup[] = ["pending", "going", "waitlisted", "maybe", "cant", "declined"];

function groupOf(rsvp: { status: SavedStatus; approval: Approval }): GuestGroup {
  return rsvp.approval === "approved" ? rsvp.status : rsvp.approval;
}

// The guest list as the host reads it: Waiting for approval, Going, the waitlist, Maybe, Can't go,
// then Declined, each group keeping the order its guests are given in. A group with nobody in it
// still comes back, so the host can see that nobody is a maybe.
export function groupByStatus<T extends { status: SavedStatus; approval: Approval }>(rsvps: T[]): { group: GuestGroup; rsvps: T[] }[] {
  return GROUPS.map((group) => ({ group, rsvps: rsvps.filter((rsvp) => groupOf(rsvp) === group) }));
}
