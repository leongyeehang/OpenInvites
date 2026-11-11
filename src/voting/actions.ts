"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/auth/session";
import { findEventBySlug, findHostEvent } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { featureOn, siteFeatures } from "@/features";
import { can } from "@/hosts/role";
import { gateFor } from "@/invites/gate";
import { isUuid } from "@/lib/uuid";
import { consume } from "@/rate-limit/rate-limit";
import { findRsvpOnThisDevice } from "@/rsvps/guest";
import { setVote, withInvite } from "./repository";
import { albumOpenTo, mayVote, mayVoteFor, openRound, type ViewerWithoutInvite } from "./voting";

// Who is in front of the album, as the comments' actions find them (comments/actions.ts,
// commenter): a host of the event first, by role, then the guest whose RSVP is on this device.
async function voterOf(eventId: string): Promise<ViewerWithoutInvite> {
  const session = await getSession();
  const hosted = session ? await findHostEvent(session.user.id, eventId) : undefined;
  if (session && hosted && can(hosted.role, "guests")) return { kind: "host", hostId: session.user.id };
  const mine = await findRsvpOnThisDevice(eventId);
  return mine ? { kind: "guest", rsvpId: mine.rsvp.id, approval: mine.rsvp.approval, status: mine.rsvp.status } : { kind: "visitor" };
}

// A vote given, moved to another item, or taken back with `photoId` null (M8 ticket 12), from a
// star in the album. Every press counts against the vote limit before anything is looked up. The
// event must open to this viewer, as its page does, with Voting switched on for the site; then the
// vote is checked again under the event's lock (repository.ts, setVote): refused as closed when no
// round is open, and as not allowed when this viewer may not vote, or not for this item. Unlike
// the album's own actions, the album's view is checked here too.
export async function setVoteAction(slug: string, awardId: string, photoId: string | null): Promise<{ error?: "tooFast" | "closed" | "notAllowed" }> {
  if (!(await consume("vote", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event || !isUuid(awardId) || (photoId !== null && !isUuid(photoId))) return { error: "closed" };
  if ((await gateFor(event)).page !== "invitation" || !featureOn(await siteFeatures(), "voting")) return { error: "closed" };
  const viewer = await withInvite(await voterOf(event.id));
  if (viewer.kind === "visitor") return { error: "notAllowed" };

  const now = new Date();
  let refusal: "closed" | "notAllowed" = "closed";
  const given = await setVote(event.id, awardId, viewer.kind === "host" ? { hostId: viewer.hostId } : { rsvpId: viewer.rsvpId }, photoId, (locked, award, item) => {
    const round = openRound(locked, award, now);
    const allowed = albumOpenTo(locked, viewer, now) && mayVote(locked, "open", viewer, now) && (photoId === null || (item !== undefined && mayVoteFor(award, item, viewer)));
    if (round !== null && allowed) return round;
    refusal = round === null ? "closed" : "notAllowed";
    return null;
  });
  if (!given) return { error: refusal };
  for (const path of eventPaths(event)) revalidatePath(path);
  return {};
}
