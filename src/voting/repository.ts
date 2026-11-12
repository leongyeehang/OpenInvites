import { and, asc, count, eq, exists, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { albumAward, albumVote, event, eventHost, photo, rsvp, user } from "@/db/schema";
import {
  albumOpenTo,
  awardPlaces,
  awardStage,
  countedVotes,
  MAX_AWARDS,
  movedAwards,
  placeable,
  tiebreakOffered,
  tiedForFirst,
  votingState,
  type AwardScope,
  type CastVote,
  type UploaderNames,
  type VotableItem,
  type ViewerWithoutInvite,
  type VotingEvent,
  type VotingViewer,
  type WhoMayVote,
} from "./voting";

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

// An event's items as the vote reads them, each with the name of whoever added it, as the album's
// listPhotos reads it (the reply's name, or the host's display name), in the order they were
// added: for the winners draft (M8 ticket 16), which reads the photo rows itself, since the module
// imports nothing of the album's (M8 plan, ruling 18).
export async function listNamedItems(eventId: string): Promise<(VotableItem & { name: string })[]> {
  return getDb()
    .select({ id: photo.id, kind: photo.kind, status: photo.status, rsvpId: photo.rsvpId, hostId: photo.hostId, name: sql<string>`coalesce(${rsvp.name}, ${user.name})` })
    .from(photo)
    .leftJoin(rsvp, eq(rsvp.id, photo.rsvpId))
    .leftJoin(user, eq(user.id, photo.hostId))
    .where(eq(photo.eventId, eventId))
    .orderBy(asc(photo.createdAt), asc(photo.id));
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

// How many votes each of an event's awards holds, by the award's id, in every round and whoever
// gave them (M8 ticket 13): every row, counted or not, since this is what removing the award, or
// turning voting off (their sum), deletes. An award with no vote is left out. A read alone, so it
// takes no lock.
export async function countAwardVotes(eventId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ awardId: albumVote.awardId, votes: count() })
    .from(albumVote)
    .innerJoin(albumAward, eq(albumAward.id, albumVote.awardId))
    .where(eq(albumAward.eventId, eventId))
    .groupBy(albumVote.awardId);
  return new Map(rows.map(({ awardId, votes }) => [awardId, votes]));
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
// again (M8 plan, ruling 20). Like starting, it needs the album open (review fix, M8 ticket 13):
// whether it was refused for that. A vote not closed is left as it is.
export async function reopenVoting(eventId: string, now: Date): Promise<{ error?: "albumNotOpen" }> {
  return getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked || !albumOpenTo(locked, A_HOST, now)) return { error: "albumNotOpen" };
    if (votingState(locked, now) !== "closed") return {};
    await tx.delete(albumVote).where(and(inArray(albumVote.awardId, awardsOf(eventId, tx)), gt(albumVote.round, 1)));
    await resetAwards(eventId, tx);
    await tx.update(event).set({ albumVoting: "open", albumVotingClosesAt: closesAtWhenOpened(locked, now) }).where(eq(event.id, eventId));
    return {};
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

// The tie-break (M8 ticket 15), each step in one transaction under the event's lock, so that it
// falls wholly before or after a vote given in the award, and each refused (false) unless the award
// is in the stage it needs: a second press, or two hosts pressing at once, changes nothing.

// One award of the event, as it stands now: its stage, and its places worked out as the album
// works them out (voting.ts, albumVotes), from the votes that count, for the items still here.
async function awardNow(eventId: string, awardId: string, locked: VotingEvent, now: Date, tx: Db) {
  const [award] = await tx
    .select()
    .from(albumAward)
    .where(and(eq(albumAward.id, awardId), eq(albumAward.eventId, eventId)));
  if (!award) return undefined;
  const votes = await listVotes(eventId, tx);
  const items = await tx.select({ id: photo.id, kind: photo.kind, status: photo.status, rsvpId: photo.rsvpId, hostId: photo.hostId }).from(photo).where(eq(photo.eventId, eventId));
  const given = countedVotes(
    votes.filter((vote) => vote.awardId === award.id),
    [award],
    items,
  );
  return { award, stage: awardStage(votingState(locked, now), award), placed: awardPlaces(award, given, placeable(award, items)) };
}

// The host starts a tie-break among the items sharing first, or another round among those still
// level after one, while tiebreakOffered holds: the award's round goes up by one, the round's
// finalists are put after those of the rounds before (voting.ts, tiebreakRounds), so the places a
// round held gave stay its own, and a shared first settled on before is unsettled.
export async function startTiebreak(eventId: string, awardId: string, now: Date): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    const found = locked && (await awardNow(eventId, awardId, locked, now, tx));
    if (!found || !tiebreakOffered(found.stage, found.award, found.placed)) return false;
    const { award, placed } = found;
    await tx
      .update(albumAward)
      .set({ round: award.round + 1, finalists: [...award.finalists, ...tiedForFirst(placed)], tiebreakOpen: true, sharedFirst: false })
      .where(eq(albumAward.id, award.id));
    return true;
  });
}

// The host closes a tie-break: its votes put its finalists in order. A tie-break has no closing
// time (M8 plan); it closes with one finalist left too, the others deleted meanwhile.
export async function closeTiebreak(eventId: string, awardId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked) return false;
    const closed = await tx
      .update(albumAward)
      .set({ tiebreakOpen: false })
      .where(and(eq(albumAward.id, awardId), eq(albumAward.eventId, eventId), eq(albumAward.tiebreakOpen, true)))
      .returning({ id: albumAward.id });
    return closed.length > 0;
  });
}

// The host keeps first place shared, while a tie-break is offered: none is offered after it.
export async function keepSharedFirst(eventId: string, awardId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    const found = locked && (await awardNow(eventId, awardId, locked, new Date(), tx));
    if (!found || !tiebreakOffered(found.stage, found.award, found.placed)) return false;
    await tx.update(albumAward).set({ sharedFirst: true }).where(eq(albumAward.id, found.award.id));
    return true;
  });
}

// The host's choice of whether guests see who added each item (M8 ticket 11), a setting kept
// whatever the vote's state.
export async function setUploaderNames(eventId: string, names: UploaderNames): Promise<void> {
  await getDb().update(event).set({ albumUploaderNames: names }).where(eq(event.id, eventId));
}

// Who may vote besides the hosts (M8 ticket 14), a setting kept whatever the vote's state. Votes
// already given stay, counted: it governs who votes from then on (M8 plan, ruling 25).
// No lockVoting: one update of the event's row waits on, and is waited on by, a vote's lock there.
export async function setWhoMayVote(eventId: string, voters: WhoMayVote): Promise<void> {
  await getDb().update(event).set({ albumVoters: voters }).where(eq(event.id, eventId));
}

// The time the vote closes by itself (M8 ticket 14), or none, under the event's lock, so that it
// falls wholly before or after a vote given. Nothing runs at that time: the vote reads closed from
// then on (voting.ts, votingState). A vote that already reads closed by its time is stored as
// closed first, so a later time, or none, never reopens it unseen: reopening is Reopen voting's,
// which also ends any tie-break.
export async function setClosingTime(eventId: string, closesAt: Date | null, now: Date): Promise<void> {
  await getDb().transaction(async (tx) => {
    const locked = await lockVoting(eventId, tx);
    if (!locked) return;
    const closedByTime = locked.albumVoting === "open" && votingState(locked, now) === "closed";
    await tx
      .update(event)
      .set({ albumVotingClosesAt: closesAt, ...(closedByTime && { albumVoting: "closed" as const }) })
      .where(eq(event.id, eventId));
  });
}

// The host's awards (M8 ticket 13), each change in one transaction under the event's lock, so that
// it falls wholly before or after a vote given in the award. An event with no award has Favourite
// made first (ensureAwards), which an `awardId` of null names: the award the Voting block shows
// before any is made.

// Every award at the place its index in `ordered` gives, 0 up: what moving and removing leave.
async function placeAwards(ordered: Award[], tx: Db): Promise<void> {
  for (const [position, award] of ordered.entries()) {
    if (award.position !== position) await tx.update(albumAward).set({ position }).where(eq(albumAward.id, award.id));
  }
}

// The award an id names among the event's, or Favourite for null, which is first.
const named = (awards: Award[], awardId: string | null) => (awardId === null ? awards[0] : awards.find((award) => award.id === awardId));

// A new award, last; refused once the event has MAX_AWARDS.
export async function addAward(eventId: string, name: string | null, scope: AwardScope): Promise<"added" | "full"> {
  return getDb().transaction(async (tx) => {
    await lockVoting(eventId, tx);
    const awards = await ensureAwards(eventId, tx);
    if (awards.length >= MAX_AWARDS) return "full";
    const last = Math.max(...awards.map((award) => award.position));
    await tx.insert(albumAward).values({ eventId, name, scope, position: last + 1 });
    return "added";
  });
}

// An award's name, null for the translated "Favourite".
export async function renameAward(eventId: string, awardId: string | null, name: string | null): Promise<void> {
  await getDb().transaction(async (tx) => {
    await lockVoting(eventId, tx);
    const award = named(await ensureAwards(eventId, tx), awardId);
    if (award) await tx.update(albumAward).set({ name }).where(eq(albumAward.id, award.id));
  });
}

// What an award takes votes for. Its votes for items it no longer takes are kept (voting.ts,
// countedVotes), so that a slip of the select costs nobody their vote (M8 plan).
export async function setAwardScope(eventId: string, awardId: string | null, scope: AwardScope): Promise<void> {
  await getDb().transaction(async (tx) => {
    await lockVoting(eventId, tx);
    const award = named(await ensureAwards(eventId, tx), awardId);
    if (award) await tx.update(albumAward).set({ scope }).where(eq(albumAward.id, award.id));
  });
}

// An award moved one place up (-1) or down (1), trading places with its neighbour.
export async function moveAward(eventId: string, awardId: string, by: -1 | 1): Promise<void> {
  await getDb().transaction(async (tx) => {
    await lockVoting(eventId, tx);
    const awards = await listAwards(eventId, tx);
    const order = movedAwards(awards.map((award) => award.id), awardId, by);
    await placeAwards(order.map((id) => awards.find((award) => award.id === id)!), tx);
  });
}

// An award removed, with its votes (they go with it, by the foreign key's cascade), and the places
// after it closed up. The event's last award stays: a vote with no award has nothing to vote in.
export async function removeAward(eventId: string, awardId: string): Promise<"removed" | "last"> {
  return getDb().transaction(async (tx) => {
    await lockVoting(eventId, tx);
    const awards = await listAwards(eventId, tx);
    if (!awards.some((award) => award.id === awardId)) return "removed";
    if (awards.length <= 1) return "last";
    await tx.delete(albumAward).where(and(eq(albumAward.id, awardId), eq(albumAward.eventId, eventId)));
    await placeAwards(awards.filter((award) => award.id !== awardId), tx);
    return "removed";
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
