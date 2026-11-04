import { getSession } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { findRsvpOnThisDevice } from "@/rsvps/guest";
import type { AlbumViewer } from "./album";

// Who is in front of an event's album, as the page and its actions decide it: a host of the event
// first, then the guest whose RSVP is on this device, with the host's word on it.
export async function albumViewer(eventId: string): Promise<AlbumViewer> {
  const session = await getSession();
  if (session && (await findHostEvent(session.user.id, eventId))) return { kind: "host", hostId: session.user.id };
  const mine = await findRsvpOnThisDevice(eventId);
  return mine ? { kind: "guest", rsvpId: mine.rsvp.id, approval: mine.rsvp.approval } : { kind: "visitor" };
}
