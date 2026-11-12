import type { Approval } from "@/rsvps/admission";
import type { SavedStatus } from "@/rsvps/form";

// The album vote's rules (M8 spec, "Voting"; ticket 10): who may vote and for what, the places
// with their ties, the tie-break's places, what is shown to whom, and each guest's order. Pure,
// with no imports but types, since client components read its lists and types. It knows album
// items by id and by the few columns of theirs it judges (M8 plan, ruling 18): nothing here comes
// from src/album.

// An event's album vote: not started (or turned off), open, or closed by the host or its closing
// time. The database enum `album_voting_state` lists the same, in db/schema.ts.
export const VOTING_STATES = ["off", "open", "closed"] as const;
export type VotingState = (typeof VOTING_STATES)[number];

// Who may vote besides the hosts, who always may: everyone who sees the whole album (the default),
// only guests who are Going, or only guests whose reply came through a personal invite link.
export const WHO_MAY_VOTE = ["album", "going", "invited"] as const;
export type WhoMayVote = (typeof WHO_MAY_VOTE)[number];

// Whether guests see who added each item: always, once voting closes (the default), or never.
export const UPLOADER_NAMES = ["always", "afterVoting", "never"] as const;
export type UploaderNames = (typeof UPLOADER_NAMES)[number];

// What an award takes votes for: photos and videos, or only one kind.
export const AWARD_SCOPES = ["all", "photos", "videos"] as const;
export type AwardScope = (typeof AWARD_SCOPES)[number];

// At most eight awards an event (M8 plan, ruling 19), and an award's name at most 40 characters,
// as char_length counts them.
export const MAX_AWARDS = 8;
export const MAX_AWARD_NAME = 40;

// What the rules read of an event.
export type VotingEvent = {
  state: "draft" | "published" | "cancelled";
  startsAt: Date | null;
  albumVisibility: "replied" | "going" | "hosts";
  albumVoting: VotingState;
  albumVotingClosesAt: Date | null;
  albumVoters: WhoMayVote;
  albumUploaderNames: UploaderNames;
};

// Who is in front of the album vote: a host of the event, a guest whose RSVP is on this device,
// with the host's word on it, what it says and whether it came through a personal invite link, or
// someone else.
export type VotingViewer =
  | { kind: "host"; hostId: string }
  | { kind: "guest"; rsvpId: string; approval: Approval; status: SavedStatus; invited: boolean }
  | { kind: "visitor" };

// The same viewer as the album knows them (album/album.ts, AlbumViewer), before the vote adds
// whether a guest came through a personal invite link (repository.ts, withInvite).
export type ViewerWithoutInvite =
  | Exclude<VotingViewer, { kind: "guest" }>
  | { kind: "guest"; rsvpId: string; approval: Approval; status: SavedStatus };

// What the album shows a viewer (album/visibility.ts, AlbumView): everything, their own, or nothing.
export type AlbumViewName = "open" | "own" | "locked";

// An album item, as the vote reads it: what it is, whether it is ready and approved, and who added it.
export type VotableItem = { id: string; kind: "photo" | "video"; status: "pending" | "approved" | "processing" | "failed"; rsvpId: string | null; hostId: string | null };

// An award as the rules read it: its name (null is the translated "Favourite"), what it takes
// votes for, its place in the list, the round being or last voted in (1, or a tie-break's), the
// items a tie-break is among, whether that tie-break is open, and whether the host settled on a
// shared first.
export type AwardRules = {
  id: string | null;
  name: string | null;
  scope: AwardScope;
  position: number;
  round: number;
  finalists: string[];
  tiebreakOpen: boolean;
  sharedFirst: boolean;
};

// The one award an event has until a host starts a vote or changes an award (M8 plan, ruling 19):
// Favourite, for photos and videos. It has no row, so no id.
export const DEFAULT_AWARD: AwardRules = { id: null, name: null, scope: "all", position: 0, round: 1, finalists: [], tiebreakOpen: false, sharedFirst: false };

// A vote given in an award, as the places count it: for which item, in which round.
export type GivenVote = { photoId: string; round: number };

// Votes per item in one round, and each item's place, both by item id.
export type Tally = Map<string, number>;
export type Places = Map<string, number>;

// Where one award stands: no vote, being voted in, a tie-break being voted in, or its results.
export type AwardStage = "off" | "voting" | "tiebreak" | "results";

// The vote as it stands now. No timer closes it: once its closing time has come it reads closed,
// to pages and actions alike (M8 spec, "Closing").
export function votingState(event: Pick<VotingEvent, "albumVoting" | "albumVotingClosesAt">, now: Date): VotingState {
  if (event.albumVoting !== "open") return event.albumVoting;
  return event.albumVotingClosesAt !== null && event.albumVotingClosesAt <= now ? "closed" : "open";
}

// Whether the album is open, from the event's start while it is published (album/album.ts,
// albumState, with the Album switched on, which the callers check).
function albumOpen(event: Pick<VotingEvent, "state" | "startsAt">, now: Date): boolean {
  return event.state === "published" && event.startsAt !== null && now >= event.startsAt;
}

// What the album shows this viewer (album/visibility.ts, albumView), restated so that the module
// imports nothing from the album (M8 plan, ruling 18); voting.test.ts holds the cases of
// visibility.test.ts that open it.
function albumViewOf(event: Pick<VotingEvent, "albumVisibility">, viewer: VotingViewer): AlbumViewName {
  if (viewer.kind === "host") return "open";
  if (viewer.kind === "visitor" || viewer.approval !== "approved") return "locked";
  if (event.albumVisibility === "replied") return "open";
  if (event.albumVisibility === "going") return viewer.status === "going" ? "open" : "own";
  return "own";
}

// Whether the album is open and shows this viewer every item: the album's own answer, for the
// module's actions, which have no album to ask.
export function albumOpenTo(event: VotingEvent, viewer: VotingViewer, now: Date): boolean {
  return albumOpen(event, now) && albumViewOf(event, viewer) === "open";
}

// Whether this person votes at all: while a vote has been started, in an open album that shows
// them every item (`view`, the album's own answer), a host always, and a guest as the host chose.
// A closed vote still answers by the person, since a tie-break is voted in while the event's vote
// is closed; whether a round is open is openRound's to say.
export function mayVote(event: VotingEvent, view: AlbumViewName, viewer: VotingViewer, now: Date): boolean {
  if (votingState(event, now) === "off" || !albumOpen(event, now) || view !== "open") return false;
  if (viewer.kind === "host") return true;
  if (viewer.kind === "visitor") return false;
  if (event.albumVoters === "going") return viewer.status === "going";
  if (event.albumVoters === "invited") return viewer.invited;
  return true;
}

// Whether an award takes votes for this kind of item.
export function inScope(award: Pick<AwardRules, "scope">, item: Pick<VotableItem, "kind">): boolean {
  return award.scope === "all" || (award.scope === "photos" ? item.kind === "photo" : item.kind === "video");
}

// Whether this item takes this person's vote in this award: approved, in its scope, not their own
// upload (a co-host's is not), and during a tie-break, one of the items tied.
export function mayVoteFor(award: AwardRules, item: VotableItem, viewer: VotingViewer): boolean {
  if (viewer.kind === "visitor" || item.status !== "approved" || !inScope(award, item)) return false;
  if (viewer.kind === "guest" ? item.rsvpId === viewer.rsvpId : item.hostId === viewer.hostId) return false;
  return !award.tiebreakOpen || award.finalists.includes(item.id);
}

// Where an award stands while the event's vote is in this state.
export function awardStage(state: VotingState, award: Pick<AwardRules, "tiebreakOpen">): AwardStage {
  if (state === "off") return "off";
  if (state === "open") return "voting";
  return award.tiebreakOpen ? "tiebreak" : "results";
}

// The round a vote given now goes to: the first while the vote is open, the tie-break's while one
// is, and none otherwise.
export function openRound(event: VotingEvent, award: AwardRules, now: Date): number | null {
  const stage = awardStage(votingState(event, now), award);
  if (stage === "voting") return 1;
  return stage === "tiebreak" ? award.round : null;
}

// Votes per item in one round.
export function tally(votes: GivenVote[], round: number): Tally {
  const counts: Tally = new Map();
  for (const vote of votes) if (vote.round === round) counts.set(vote.photoId, (counts.get(vote.photoId) ?? 0) + 1);
  return counts;
}

// Each item's place by its votes, sharing a place on a tie and skipping the places the tie took
// (12, 12, 9: first, first, third). An item with no vote has no place.
export function places(counts: Tally): Places {
  const voted = [...counts].filter(([, count]) => count > 0);
  return new Map(voted.map(([id, count]) => [id, 1 + voted.filter(([, other]) => other > count).length]));
}

// The ribbon an item wears for its place: first to third, and none after.
export function ribbon(place: number | undefined): 1 | 2 | 3 | undefined {
  return place === 1 || place === 2 || place === 3 ? place : undefined;
}

// The items sharing first place; none when one item is first alone. A tie-break is offered for
// first place only (M8 spec, "Tie-break").
export function tiedForFirst(placed: Places): string[] {
  const first = [...placed].filter(([, place]) => place === 1).map(([id]) => id);
  return first.length > 1 ? first : [];
}

// The places once a tie-break is closed: the items that shared first are put in order among
// themselves by its votes, in the places they shared (two that shared first become first and
// second, or stay level if its votes are level); every other item keeps its place.
export function finalPlaces(before: Places, tiebreak: Tally): Places {
  const tied = tiedForFirst(before);
  const after = new Map(before);
  const votesOf = (id: string) => tiebreak.get(id) ?? 0;
  for (const id of tied) after.set(id, 1 + tied.filter((other) => votesOf(other) > votesOf(id)).length);
  return after;
}

// An award's places as they stand: the first round's, then each tie-break's in turn up to the
// award's current round, which is left out while its tie-break is still being voted in.
export function awardPlaces(award: AwardRules, votes: GivenVote[]): Places {
  const last = award.tiebreakOpen ? award.round - 1 : award.round;
  let placed = places(tally(votes, 1));
  for (let round = 2; round <= last; round++) placed = finalPlaces(placed, tally(votes, round));
  return placed;
}

// Whether the host is offered a tie-break: on the results, while first is shared and the host has
// not settled on sharing it.
export function tiebreakOffered(stage: AwardStage, award: Pick<AwardRules, "sharedFirst">, placed: Places): boolean {
  return stage === "results" && !award.sharedFirst && tiedForFirst(placed).length > 0;
}

// Whether the counts are shown: to the hosts whenever there is a vote, and to guests once an
// award's results are in. It takes the award's stage, since a tie-break hides its counts from
// guests while the event's vote is closed.
export function countsShown(stage: AwardStage, viewer: VotingViewer): boolean {
  return viewer.kind === "host" ? stage !== "off" : stage === "results";
}

// Whether a viewer is shown who added an item: the hosts and the item's own uploader always;
// anyone else as the host chose, where "after voting" hides names only while the vote is open, so
// an event that never votes shows them as it always did.
export function namesShown(event: Pick<VotingEvent, "albumUploaderNames">, state: VotingState, viewer: ViewerWithoutInvite, item: Pick<VotableItem, "rsvpId">): boolean {
  if (viewer.kind === "host" || (viewer.kind === "guest" && item.rsvpId === viewer.rsvpId)) return true;
  if (event.albumUploaderNames === "always") return true;
  if (event.albumUploaderNames === "never") return false;
  return state !== "open";
}

// Whether the album shows this viewer who added each item (M8 ticket 11), decided per item on the
// server before anything is sent. With Voting switched off for the site every name shows, as
// before 0.8, whatever the event's setting: the setting lives in the Voting block, which is not
// shown then, and a host could not see why names were missing (M8 plan). Otherwise as namesShown
// says, with the vote as it stands now. Whether a guest came through a personal invite does not
// matter here, so the album asks without reading it (M8 ticket 12).
export function nameShownTo(votingOn: boolean, event: VotingEvent, viewer: ViewerWithoutInvite, now: Date): (item: Pick<VotableItem, "rsvpId" | "hostId">) => boolean {
  if (!votingOn) return () => true;
  const state = votingState(event, now);
  return (item) => namesShown(event, state, viewer, item);
}

// A small string hash (FNV-1a, 32 bits, with a final mix so that near keys part well). Not for
// secrets: it only orders items, and runs in the browser too, where node:crypto is not.
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

// The album in an order of this viewer's own while voting is open (M8 spec, "What guests see while
// open"): the same each time they look, different from the next guest's, so an early upload has no
// advantage. Each item is placed by a hash of the viewer and the item alone, so an item added later
// leaves the others in their order.
export function shuffledFor(viewerKey: string, ids: string[]): string[] {
  const keyed = ids.map((id) => ({ id, key: hash(`${viewerKey}:${id}`) }));
  return keyed.sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(({ id }) => id);
}

// An event's awards, or Favourite alone while it has none (M8 plan, ruling 19).
export function awardsOrDefault(awards: AwardRules[]): AwardRules[] {
  return awards.length > 0 ? awards : [DEFAULT_AWARD];
}

// A vote as the album reads it (repository.ts, listVotes): in which award and round, for which
// item, and by whom, a guest through their RSVP or a host.
export type CastVote = GivenVote & { awardId: string; rsvpId: string | null; hostId: string | null };

// What one item shows of one award: whether this viewer may vote for it now, its votes where this
// viewer is shown them (the first round's, 0 included), and its ribbon once the award's results are
// in. A key left out is not sent: a guest's page carries no count while voting is open (M8 spec).
export type ItemStanding = { may: boolean; shownVotes?: number; place?: 1 | 2 | 3 };

// Where one award stands for this viewer (M8 ticket 12): its stage, the items it lists (those in
// its scope, in the album's order), this viewer's vote in its current round, for a host the votes
// given in that round so far, and what each item it lists shows.
export type AwardStanding = { award: AwardRules; stage: AwardStage; ids: string[]; voted: string | null; total?: number; items: Map<string, ItemStanding> };

// Each award as this viewer's album shows it, from the event's votes and the items this viewer
// sees (`view`, the album's own answer). Only an award's votes for the items it lists count, so a
// vote for an item it no longer shows is kept but not counted (M8 plan, ruling 23).
export function albumVotes(event: VotingEvent, view: AlbumViewName, viewer: VotingViewer, now: Date, awards: AwardRules[], votes: CastVote[], items: VotableItem[]): AwardStanding[] {
  const state = votingState(event, now);
  const votesHere = mayVote(event, view, viewer, now);
  const mine = (vote: CastVote) => (viewer.kind === "guest" ? vote.rsvpId === viewer.rsvpId : viewer.kind === "host" && vote.hostId === viewer.hostId);
  return awards.map((award) => {
    const stage = awardStage(state, award);
    const listed = items.filter((item) => inScope(award, item));
    const ids = listed.map((item) => item.id);
    const given = votes.filter((vote) => vote.awardId === award.id && ids.includes(vote.photoId));
    const round = openRound(event, award, now);
    const counts = tally(given, 1);
    const shown = countsShown(stage, viewer);
    const placed = stage === "results" ? awardPlaces(award, given) : undefined;
    const standings = new Map(
      listed.map((item): [string, ItemStanding] => {
        const place = placed && ribbon(placed.get(item.id));
        return [
          item.id,
          {
            may: votesHere && round !== null && mayVoteFor(award, item, viewer),
            ...(shown && { shownVotes: counts.get(item.id) ?? 0 }),
            ...(place && { place }),
          },
        ];
      }),
    );
    const voted = given.find((vote) => vote.round === award.round && mine(vote))?.photoId ?? null;
    const total = viewer.kind === "host" ? given.filter((vote) => vote.round === award.round).length : undefined;
    return { award, stage, ids, voted, ...(total !== undefined && { total }), items: standings };
  });
}

// A press of a star not yet confirmed by the page (M8 ticket 12): the item chosen, or none, the
// drawing of the page it is shown over (each drawing of the album carries a token of its own), and
// how many presses are still on their way.
export type PendingVote = { choice: string | null; drawn: string; sending: number };

// The vote a star and the head show: the pending choice while a press is on its way, and after
// its answer while the page is still the drawing it was shown over; once a new drawing arrives,
// the page's own vote, whatever it is (review fix: an item deleted, or voting turned off and on,
// takes the vote away without a press).
export function voteShown(pending: PendingVote | undefined, voted: string | null, drawn: string): string | null {
  return pending && (pending.sending > 0 || pending.drawn === drawn) ? pending.choice : voted;
}
