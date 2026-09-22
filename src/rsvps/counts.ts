import { RSVP_STATUSES, type RsvpStatus } from "./form";

// What one status contributes to one event, as the database groups the RSVPs.
export type StatusTally = { status: RsvpStatus; rsvps: number; plusOnes: number };

// How an event's replies read: how many said each thing, and how many people to expect.
export type RsvpCounts = { going: number; maybe: number; cant: number; headcount: number };

export const NO_RSVPS: RsvpCounts = { going: 0, maybe: 0, cant: 0, headcount: 0 };

// Headcount is every Going guest plus their plus-ones. Maybe is never counted, however many
// people a maybe would bring (CONTEXT.md, "Headcount").
export function countRsvps(tallies: StatusTally[]): RsvpCounts {
  const counts = { ...NO_RSVPS };
  for (const tally of tallies) {
    counts[tally.status] += tally.rsvps;
    if (tally.status === "going") counts.headcount += tally.rsvps + tally.plusOnes;
  }
  return counts;
}

// One RSVP is a tally of one, so a list loaded from the database counts by exactly the rule a
// grouped query does.
export function asTally(rsvp: { status: RsvpStatus; plusOnes: number }): StatusTally {
  return { status: rsvp.status, rsvps: 1, plusOnes: rsvp.plusOnes };
}

// The guest list as the host reads it: Going, then Maybe, then Can't go, in the order the RSVP
// buttons show them, each group keeping the order its guests arrived in. A group with nobody in
// it still comes back, so the host can see that nobody is a maybe.
export function groupByStatus<T extends { status: RsvpStatus }>(rsvps: T[]): { status: RsvpStatus; rsvps: T[] }[] {
  return RSVP_STATUSES.map((status) => ({ status, rsvps: rsvps.filter((rsvp) => rsvp.status === status) }));
}
