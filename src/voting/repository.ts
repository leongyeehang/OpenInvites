import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { albumAward, albumVote, event } from "@/db/schema";
import { albumOpenTo, votingState, type VotingEvent, type VotingViewer } from "./voting";

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

// An event's awards, in the host's order.
export async function listAwards(eventId: string, db: Db = getDb()): Promise<Award[]> {
  return db.select().from(albumAward).where(eq(albumAward.eventId, eventId)).orderBy(asc(albumAward.position), asc(albumAward.id));
}

// Every vote given in an event's awards, in every round.
export async function listVotes(eventId: string, db: Db = getDb()): Promise<{ awardId: string; round: number; photoId: string; rsvpId: string | null; hostId: string | null }[]> {
  return db
    .select({ awardId: albumVote.awardId, round: albumVote.round, photoId: albumVote.photoId, rsvpId: albumVote.rsvpId, hostId: albumVote.hostId })
    .from(albumVote)
    .innerJoin(albumAward, eq(albumAward.id, albumVote.awardId))
    .where(eq(albumAward.eventId, eventId));
}

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

// A duplicate's awards (events/actions.ts, duplicateEventAction): each award's name, scope and
// place, and nothing of its rounds; the copy starts with voting off, as a new event does.
export async function copyAwards(fromEventId: string, toEventId: string): Promise<void> {
  const awards = await listAwards(fromEventId);
  if (awards.length === 0) return;
  await getDb()
    .insert(albumAward)
    .values(awards.map(({ name, scope, position }) => ({ eventId: toEventId, name, scope, position })));
}
