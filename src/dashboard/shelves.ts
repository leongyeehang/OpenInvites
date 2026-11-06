import type { HostEvent } from "@/events/repository";
import { partitionByEnd } from "@/events/time";
import type { RsvpCounts } from "@/rsvps/counts";

// The rules behind the dashboard (dashboard spec, "What the dashboard shows"): which event is Next
// up, which shelf every other one is on, and the one chip and one number a tile carries. The page
// draws what these return and decides nothing itself.

// An event as the dashboard has it: how its replies stand, and the day it will be deleted once it
// is marked for its age (null until then).
export type ShelfEvent = HostEvent & { counts: RsvpCounts; deletion: Date | null };

export type Shelves = { nextUp: ShelfEvent | null; comingUp: ShelfEvent[]; drafts: ShelfEvent[]; past: ShelfEvent[] };

export type WhenKind = "dated" | "poll" | "none";

export type TileChip = { kind: "toApprove"; count: number } | { kind: "cancelled" } | { kind: "draft" } | { kind: "coHost" };

export type TileNumber =
  | { kind: "places"; headcount: number; capacity: number }
  | { kind: "going"; count: number }
  | { kind: "went"; count: number }
  | { kind: "deletion"; date: Date };

// Next up is the soonest published event: a draft or a cancelled event never is, however soon. An
// event whose date is still being voted on sorts after every dated one, as partitionByEnd has it.
// A draft that has ended stays under Past, where it has always been.
export function shelve(events: ShelfEvent[], now: Date): Shelves {
  const { upcoming, past } = partitionByEnd(events, now);
  const nextUp = upcoming.find((event) => event.state === "published") ?? null;
  return {
    nextUp,
    comingUp: upcoming.filter((event) => event !== nextUp && event.state !== "draft"),
    drafts: upcoming.filter((event) => event.state === "draft"),
    past,
  };
}

// A date poll counts only while it is open: once closed, the event has its date or has none yet.
export function whenKind(event: ShelfEvent): WhenKind {
  if (event.startsAt !== null) return "dated";
  if (event.pollOpenedAt !== null && event.pollClosedAt === null) return "poll";
  return "none";
}

// Guests waiting for the host come first: that is the one thing on a tile that asks for something.
export function tileChip(event: ShelfEvent): TileChip | null {
  if (event.counts.pending > 0) return { kind: "toApprove", count: event.counts.pending };
  if (event.state === "cancelled") return { kind: "cancelled" };
  if (event.state === "draft") return { kind: "draft" };
  if (event.role === "coHost") return { kind: "coHost" };
  return null;
}

export function tileNumber(event: ShelfEvent, shelf: "comingUp" | "drafts" | "past"): TileNumber {
  if (shelf === "past") return event.deletion ? { kind: "deletion", date: event.deletion } : { kind: "went", count: event.counts.going };
  if (event.capacity !== null) return { kind: "places", headcount: event.counts.headcount, capacity: event.capacity };
  return { kind: "going", count: event.counts.going };
}

// Whose poster lends the page its glow: Next up's, else the first event on the page.
export function glowEvent({ nextUp, comingUp, drafts, past }: Shelves): ShelfEvent | null {
  return nextUp ?? comingUp[0] ?? drafts[0] ?? past[0] ?? null;
}
