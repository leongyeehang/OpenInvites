import type { EventState } from "./repository";

// What a visitor gets when they open an event link. A draft is its host's alone and shows the
// "not ready yet" page to everyone else; a cancelled event keeps its page, with the notice and
// no way to answer (spec, "Events and RSVPs": Draft → Published → Cancelled).
export type EventPage = "invitation" | "notReady";

export function eventPageFor(state: EventState, viewer: { isHost: boolean }): EventPage {
  return state !== "draft" || viewer.isHost ? "invitation" : "notReady";
}

// Only a published event takes answers: a draft is not public yet, and a cancelled one is not
// happening (spec, story 63).
export function acceptsRsvps(state: EventState): boolean {
  return state === "published";
}
