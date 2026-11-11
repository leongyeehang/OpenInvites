import { and, asc, count, eq, exists, gt, inArray, isNull, or } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { albumAward, albumVote, event, eventHost, photo, rsvp } from "@/db/schema";
import { albumOpenTo, votingState, type CastVote, type UploaderNames, type VotableItem, type ViewerWithoutInvite, type VotingEvent, type VotingViewer } from "./voting";

export type Award = typeof albumAward.$inferSelect;

// Any host of the event: the album is open to every host alike (voting.ts, albumOpenTo).
const A_HOST: VotingViewer = { kind: "host", hostId: "" };

// The event's row, locked for the rest of the transaction as adding photos locks it
// (album/repository.ts, addPhotos), read as the vote's rules read it: so that a vote given and the
// host's closing, reopening or turning off cannot cross.
export async function lockVoting(eventId: string, tx: Db): Promise<VotingEvent | undefined> {
  const [locked] = await tx
    .select({
      state: event.state,
      startsAt: event.startsAt,
      albumVisibility: event.albumVisibility,
      albumVoting: event.albumVoting,
      albumVotingClosesAt: event.albumVotingClosesAt,
      albumVoters: event.albumVoters,
      albumUploaderNames: event.albumUploaderNames,
    })
    .from(event)
    .where(eq(event.id, eventId))
    .for("no key update");
  return locked;
}

// The viewer as the vote reads them (M8 ticket 11): a guest gains whether their RSVP came through a
// personal invite link, which only the vote asks; anyone else is as they are.
export async function withInvite(viewer: ViewerWithoutInvite, db: Db = getDb()): Promise<VotingViewer> {
  if (viewer.kind !== "guest") return viewer;
  const [found] = await db.select({ inviteId: rsvp.inviteId }).from(rsvp).where(eq(rsvp.id, viewer.rsvpId));
  return { kind: "guest", rsvpId: viewer.rsvpId, approval: viewer.approval, status: viewer.status, invited: found?.inviteId != null };
}

// An event's awards, in the host's order.
export async function listAwards(eventId: string, db: Db = getDb()): Promise<Award[]> {
  return db.select().from(albumAward).where(eq(albumAward.eventId, eventId)).orderBy(asc(albumAward.position), asc(albumAward.id));
}

// Every vote given in an event's awards, in every round. A host's vote counts only while they host
// the event, as its owner or a co-host (M8 ticket 12): a co-host removed takes their votes out of
// the count, and added again, brings them back, since the rows stay.
export async function listVotes(eventId: string, db: Db = getDb()): Promise<CastVote[]> {
  const coHosts = db
    .select({ hostId: eventHost.hostId })
    .from(eventHost)
    .where(and(eq(eventHost.eventId, eventId), eq(eventHost.hostId, albumVote.hostId)));
  return db
    .select({ awardId: albumVote.awardId, round: albumVote.round, photoId: albumVote.photoId, rsvpId: albumVote.rsvpId, hostId: albumVote.hostId })
    .from(albumVote)
    .innerJoin(albumAward, eq(albumAward.id, albumVote.awardId))
    .innerJoin(event, eq(event.id, albumAward.eventId))
    .where(and(eq(albumAward.eventId, eventId), or(isNull(albumVote.hostId), eq(albumVote.hostId, event.hostId), exists(coHosts))));
}

// Who gives a vote: a guest through their RSVP, or a host. ("Voter" is the date poll's word.)
export type GivenBy = { rsvpId: string } | { hostId: string };

// How many votes an event's awards hold, in every round: what turning voting off deletes.
export async function countVotes(eventId: string): Promise<number> {
  const [{ votes }] = await getDb()
    .select({ votes: count() })
    .from(albumVote)
    .innerJoin(albumAward, eq(albumAward.id, albumVote.awardId))
    .where(eq(albumAward.eventId, eventId));
  return votes;
}

// An event's awards, with Favourite made first when it has none (M8 plan, ruling 19): it is made
// when a vote first needs it, under the event's lock, which the caller holds.
export async function ensureAwards(eventId: string, tx: Db): Promise<Award[]> {
  const awards = await listAwards(eventId, tx);
  if (awards.length > 0) return awards;
  return tx.insert(albumAward).values({ eventId, name: null, scope: "all", position: 0 }).returning();
}

// The votes of an event's awards, as a subquery.
const awardsOf = (eventId: string, tx: Db) => tx.select({ id: albumAward.id }).from(albumAward).where(eq(albumAward.eventId, eventId));

// Every award back to its first round, with no tie-break: no finalists, none open, no shared first.
async function resetAwards(eventId: string, tx: Db): Promise<void> {
  await tx.update(albumAward).set({ round: 1, finalists: [], tiebreakOpen: false, sharedFirst: false }).where(eq(albumAward.eventId, eventId));
}

// A closing time that has passed is cleared when the vote is opened, or it would read closed at
// once (M8 plan, ruling 20); one still ahead stays.
const closesAtWhenOpened = (locked: VotingEvent, now: Date) => (locked.albumVotingClosesAt !== null && locked.albumVotingClosesAt <= now ? null : locked.albumVotingClosesAt);

// The host starts the vote, which needs the album open (M8 plan, ruling 20): whether it was
// refused for that. Favourite is made if the event has no award. A vote already started is left
// as it is.
export async function startVoting(eventId: string, now: Date): Promise<{ error?: "albumNotOpen" }> {
  return getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked || !albumOpenTo(locked, A_HOST, now)) return { error: "albumNotOpen" };
    if (locked.albumVoting !== "off") return {};
    await ensureAwards(eventId, tx);
    await tx.update(event).set({ albumVoting: "open", albumVotingClosesAt: closesAtWhenOpened(locked, now) }).where(eq(event.id, eventId));
    return {};
  });
}

// The host closes an open vote; its votes stay.
export async function closeVoting(eventId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (locked?.albumVoting !== "open") return;
    await tx.update(event).set({ albumVoting: "closed" }).where(eq(event.id, eventId));
  });
}

// The host reopens a closed vote, closed by them or by its time. Its first round's votes stay; any
// tie-break ends and its votes go, since the first round's places may change once guests vote
// again (M8 plan, ruling 20).
export async function reopenVoting(eventId: string, now: Date): Promise<void> {
  await getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked || votingState(locked, now) !== "closed") return;
    await tx.delete(albumVote).where(and(inArray(albumVote.awardId, awardsOf(eventId, tx)), gt(albumVote.round, 1)));
    await resetAwards(eventId, tx);
    await tx.update(event).set({ albumVoting: "open", albumVotingClosesAt: closesAtWhenOpened(locked, now) }).where(eq(event.id, eventId));
  });
}

// The host turns the vote off, after a confirmation that gives the number of its votes: every vote
// goes, and every award is back to its first round. The awards and the settings stay.
export async function turnOffVoting(eventId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked) return;
    await tx.delete(albumVote).where(inArray(albumVote.awardId, awardsOf(eventId, tx)));
    await resetAwards(eventId, tx);
    await tx.update(event).set({ albumVoting: "off" }).where(eq(event.id, eventId));
  });
}

// A vote given, moved or taken back (M8 ticket 12), in one transaction under the event's lock, so
// that it falls wholly before or after a host's closing, reopening or turning off. The award and
// the item are read scoped to the event; `allowed` names the round the vote goes to, or refuses
// it with null. The voter's vote in that award and round goes, and one for `photoId` is given in
// its place when it names an item, so the same request twice leaves the same vote. False when
// refused.
export async function setVote(
  eventId: string,
  awardId: string,
  voter: GivenBy,
  photoId: string | null,
  allowed: (locked: VotingEvent, award: Award, item: VotableItem | undefined) => number | null,
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked) return false;
    const [award] = await tx
      .select()
      .from(albumAward)
      .where(and(eq(albumAward.id, awardId), eq(albumAward.eventId, eventId)));
    if (!award) return false;
    const [item] =
      photoId === null
        ? []
        : await tx
            .select({ id: photo.id, kind: photo.kind, status: photo.status, rsvpId: photo.rsvpId, hostId: photo.hostId })
            .from(photo)
            .where(and(eq(photo.id, photoId), eq(photo.eventId, eventId)));
    const round = allowed(locked, award, item);
    if (round === null) return false;
    const byVoter = "rsvpId" in voter ? eq(albumVote.rsvpId, voter.rsvpId) : eq(albumVote.hostId, voter.hostId);
    await tx.delete(albumVote).where(and(eq(albumVote.awardId, award.id), eq(albumVote.round, round), byVoter));
    if (photoId !== null) await tx.insert(albumVote).values({ awardId: award.id, round, photoId, ...voter });
    return true;
  });
}

// The host's choice of whether guests see who added each item (M8 ticket 11), a setting kept
// whatever the vote's state.
export async function setUploaderNames(eventId: string, names: UploaderNames): Promise<void> {
  await getDb().update(event).set({ albumUploaderNames: names }).where(eq(event.id, eventId));
}

// A duplicate's awards (events/actions.ts, duplicateEventAction): each award's name, scope and
// place, and nothing of its rounds; the copy starts with voting off, as a new event does.
export async function copyAwards(fromEventId: string, toEventId: string): Promise<void> {
  const awards = await listAwards(fromEventId);
  if (awards.length === 0) return;
  await getDb()
    .insert(albumAward)
    .values(awards.map(({ name, scope, position }) => ({ eventId: toEventId, name, scope, position })));
}
