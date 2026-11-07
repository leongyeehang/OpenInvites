import { cache } from "react";
import { eventPageFor, type EventPage } from "@/events/access";
import { isHostOf } from "@/events/hosts";
import type { EventState } from "@/events/repository";
import { findRsvpOnThisDevice } from "@/rsvps/guest";
import type { MyRsvp } from "@/rsvps/repository";
import { admitted } from "./access";
import { deviceInvite } from "./device";
import type { Invite } from "./repository";

// Who is in front of an event, and what its page is to them (M6 spec, "Architecture"): whether they
// host it, the RSVP this device holds, the invite it stands for, and so whether they see the
// invitation, the "not ready" page or the locked page (events/access.ts). The page and every action
// and route that opens an event by its link ask this one gate, and go no further for anyone it does
// not show the invitation to.
export type Gate = { isHost: boolean; mine: MyRsvp | undefined; invite: Invite | undefined; page: EventPage };

// The invite the device stands for is its pass's, or its invite cookie's, or failing both the one
// its reply is tied to (deviceInvite), and who it admits is invites/access.ts's rule; it is asked
// for only where it decides anything, on an invite-only event, of someone who does not host it.
// Cached per request by what decides it, so the page, its metadata and an action redrawing it ask
// once.
const gate = cache(async (eventId: string, state: EventState, inviteOnly: boolean): Promise<Gate> => {
  const [isHost, mine] = await Promise.all([isHostOf(eventId), findRsvpOnThisDevice(eventId)]);
  if (!inviteOnly || isHost) return { isHost, mine, invite: undefined, page: eventPageFor({ state, inviteOnly }, { isHost, admitted: false }) };
  const { invite, pass } = await deviceInvite(eventId, mine);
  const page = eventPageFor({ state, inviteOnly }, { isHost, admitted: admitted({ pass, invite }) });
  return { isHost, mine, invite, page };
});

export function gateFor(event: { id: string; state: EventState; inviteOnly: boolean }): Promise<Gate> {
  return gate(event.id, event.state, event.inviteOnly);
}
