import type { RsvpStatus, SavedStatus } from "./form";

// What a saved reply becomes (spec, "Architecture", "Capacity and the waitlist" and "Approval"):
// one pure rule, called inside the one transaction that writes an RSVP with the event's row
// locked, so two replies cannot both take the last place (repository.ts).

// The status the guest asked for: one of the three they can choose.
export type Wanted = RsvpStatus;

// Whether the host has let the reply onto the list: approved, waiting for the host (pending), or
// declined by them. A reply to an event without approval is approved. The list is the source, as
// form.ts's RSVP_STATUSES is, and the database enum is built from it.
export const APPROVALS = ["approved", "pending", "declined"] as const;

export type Approval = (typeof APPROVALS)[number];

// The event's settings, where the reply came from, what it asks and for how many, and what is
// already counted. `headcount` is the approved Going replies other than this one, with their
// plus-ones; `party` is the guest and their plus-ones; `current` is the reply as stored, when there
// is one.
export type AdmissionInput = {
  approvalRequired: boolean;
  capacity: number | null;
  headcount: number;
  invited: boolean;
  wanted: Wanted;
  party: number;
  current?: { status: SavedStatus; approval: Approval; party: number };
};

export type Admission = { status: SavedStatus; approval: Approval } | { refused: "capacityFull"; placesLeft: number };

// A reply keeps the approval it has: only the host changes it (repository.ts, approveRsvp and
// declineRsvp). A new one waits for the host when the event asks for approval, unless it came
// through a personal invite, which the host issued (spec, "decided here").
//
// Maybe and Can't go are saved as asked: they take no place. Going takes the party's places when
// it fits, the whole party or none of it (spec, "decided here"); otherwise it waits on the
// waitlist. A Going guest keeps their place: only bringing more people than the room left is
// refused, with the places their party may have, and nobody is moved by a capacity lowered below
// the headcount. A reply the host has not let onto the list (pending or declined) takes no place
// and waits for none: it is saved as asked, and approving it admits it as a new reply would. A
// guest already waiting stays waiting, however much room there is: promotion takes the waitlist
// in order (waitlist.ts).
export function admit({ approvalRequired, capacity, headcount, invited, wanted, party, current }: AdmissionInput): Admission {
  const approval: Approval = current?.approval ?? (approvalRequired && !invited ? "pending" : "approved");
  if (wanted !== "going" || capacity === null) return { status: wanted, approval };
  const fits = headcount + party <= capacity;
  if (current?.status === "going" && current.approval === "approved") {
    if (fits || party <= current.party) return { status: "going", approval };
    return { refused: "capacityFull", placesLeft: Math.max(0, capacity - headcount) };
  }
  if (approval !== "approved") return { status: "going", approval };
  if (current?.status === "waitlisted") return { status: "waitlisted", approval };
  return { status: fits ? "going" : "waitlisted", approval };
}

// Whether the event has no place left even for a guest coming alone: the page then says that a
// Going reply joins the waitlist (spec, "Capacity and the waitlist").
export function isFull(capacity: number | null, headcount: number): boolean {
  return capacity !== null && headcount >= capacity;
}

// When a reply took its place on the waitlist, which is its place in the order: now for one that
// joins it, unchanged for one that stays on it (editing their details keeps a guest's place), and
// none for one that leaves it or was never on it.
export function waitlistedSince(
  status: SavedStatus,
  current: { status: SavedStatus; waitlistedAt: Date | null } | undefined,
  now: Date,
): Date | null {
  if (status !== "waitlisted") return null;
  return current?.status === "waitlisted" ? current.waitlistedAt : now;
}

// When a reply was promoted from the waitlist, which only a promotion sets (repository.ts,
// promoteWaitlist, moveToGoing): kept while the reply stays Going, and taken off in the same write
// that takes it out of Going, so a later return to Going into a full event is not read as a
// promotion.
export function promotedSince(status: SavedStatus, current: { promotedAt: Date | null } | undefined): Date | null {
  return status === "going" ? (current?.promotedAt ?? null) : null;
}

// The status a host's edit gives a reply: the one the host chose, never refused by capacity (spec,
// "decided here"). The host's form offers the three a guest can choose, and Going is what a
// waitlisted guest asked for, so saving them as Going keeps them waiting; the host moves them to
// Going with Move to Going (repository.ts, moveToGoing).
export function hostStatus(chosen: RsvpStatus, current: SavedStatus): SavedStatus {
  return chosen === "going" && current === "waitlisted" ? "waitlisted" : chosen;
}
