// Who may do what with an event (spec, "Co-hosts"). The host who created it is its owner; a
// co-host (CONTEXT.md) shares its management and can do everything the owner can, except delete
// the event or change who its co-hosts are. Every event action asks here, through the one gate
// that answers owner, co-host or nothing (events/repository.ts, findHostEvent).

export const ACTIONS = [
  "edit",
  "publish",
  "cancel",
  "design",
  "questions",
  "guests",
  "announcements",
  "comments",
  "share",
  "resetLink",
  "duplicate",
  "delete",
  "manageCoHosts",
] as const;

export type Action = (typeof ACTIONS)[number];

export type Role = "owner" | "coHost";

const OWNER_ONLY: readonly Action[] = ["delete", "manageCoHosts"];

export function can(role: Role, action: Action): boolean {
  return role === "owner" || !OWNER_ONLY.includes(action);
}

// The role of a host the gate has already found the event for: the owner is the event's host, and
// anyone else it answers for is a co-host.
export function roleOf(event: { hostId: string }, hostId: string): Role {
  return event.hostId === hostId ? "owner" : "coHost";
}
