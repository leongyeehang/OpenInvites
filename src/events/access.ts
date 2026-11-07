import type { EventState } from "./repository";

// What a visitor gets when they open an event link. A draft is its host's alone and shows the
// "not ready yet" page to everyone else; a cancelled event keeps its page, with the notice and
// no way to answer (spec, "Events and RSVPs": Draft → Published → Cancelled). An invite-only event
// shows the locked page to anyone who is not in (invites/access.ts), after the draft's check and
// before the cancelled notice, which only those in see (M6 spec, "The locked page"). Its hosts see
// the invitation in every state.
export type EventPage = "invitation" | "notReady" | "locked";

export function eventPageFor(event: { state: EventState; inviteOnly: boolean }, viewer: { isHost: boolean; admitted: boolean }): EventPage {
  if (viewer.isHost) return "invitation";
  if (event.state === "draft") return "notReady";
  if (event.inviteOnly && !viewer.admitted) return "locked";
  return "invitation";
}

// Only a published event takes answers: a draft is not public yet, and a cancelled one is not
// happening (spec, story 63).
export function acceptsRsvps(state: EventState): boolean {
  return state === "published";
}
