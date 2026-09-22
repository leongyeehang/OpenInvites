// Who may see an event's guest list, as the host chooses (spec, story 26). "After you reply"
// makes the list a reward for answering, and is the default.
export const GUEST_LIST_VISIBILITIES = ["always", "afterReply", "hidden"] as const;

export type GuestListVisibility = (typeof GUEST_LIST_VISIBILITIES)[number];

export const DEFAULT_GUEST_LIST_VISIBILITY: GuestListVisibility = "afterReply";

// What a guest may see of the guest list: the names, a blurred promise of them, or nothing at
// all. Counts follow the same rule, so a locked list gives away no numbers either (spec,
// "RSVP flow": counts are shown to guests according to the visibility setting).
export type GuestListView = "open" | "locked" | "hidden";

export function guestListView(visibility: GuestListVisibility, guest: { hasRsvp: boolean }): GuestListView {
  if (visibility === "hidden") return "hidden";
  return visibility === "always" || guest.hasRsvp ? "open" : "locked";
}
