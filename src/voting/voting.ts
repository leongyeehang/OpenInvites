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
// items each tie-break round is among (tiebreakRounds), whether that tie-break is open, and
// whether the host settled on a shared first.
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

// Why a closing time the host sets is refused (M8 ticket 14): one that has come already would
// close the vote the moment it is saved, so it is refused when it is set (M8 plan, ruling 26).
export function closingTimeProblem(closesAt: Date, now: Date): "past" | undefined {
  return closesAt <= now ? "past" : undefined;
}

// Whom the "Voting is open" draft is emailed to at first (M8 ticket 14): Going alone when only
// guests who are going may vote, or when the album itself shows only to them, since a Maybe guest
// told to open the album could not see it (the voting part's review, finding 7); otherwise the
// Announcements form's own default, since "invited personally" has no status to tick (the Voting
// block says so).
export function draftAudience(event: Pick<VotingEvent, "albumVoters" | "albumVisibility">): SavedStatus[] | undefined {
  return event.albumVoters === "going" || event.albumVisibility === "going" ? ["going"] : undefined;
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
// upload (a co-host's is not), and during a tie-break, one of the items its round is among.
export function mayVoteFor(award: AwardRules, item: VotableItem, viewer: VotingViewer): boolean {
  if (viewer.kind === "visitor" || item.status !== "approved" || !inScope(award, item)) return false;
  if (viewer.kind === "guest" ? item.rsvpId === viewer.rsvpId : item.hostId === viewer.hostId) return false;
  return !award.tiebreakOpen || roundFinalists(award).includes(item.id);
}

// The finalists of each tie-break round an award has held or is holding, in turn (M8 ticket 15).
// The award stores them in one list, each round's after the one before it (repository.ts,
// startTiebreak): another round is among some of the items of the round before, so a round's list
// starts where an item of the list before comes again. The first list is round 2's.
export function tiebreakRounds(finalists: string[]): string[][] {
  const rounds: string[][] = [];
  for (const id of finalists) {
    const current = rounds.at(-1);
    if (current && !current.includes(id)) current.push(id);
    else rounds.push([id]);
  }
  return rounds;
}

// The items the award's own round is among: the tie-break's being voted in, or the last one held;
// none in the first round.
function roundFinalists(award: Pick<AwardRules, "round" | "finalists">): string[] {
  return award.round > 1 ? (tiebreakRounds(award.finalists)[award.round - 2] ?? []) : [];
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

// A closed tie-break round as the places read it: the items it was held among, as stored when it
// opened, and its votes.
export type HeldRound = { finalists: string[]; counts: Tally };

// The places once tie-break rounds have been held (M8 spec, "Tie-break"): the finalists of the
// first round held take the places from first, put in order among themselves by its votes (two
// that shared first become first and second, or stay level if its votes are level, and one it gave
// no vote comes after the others). Where another round was held among those still level, they take
// the first of those places in its order, and the rest follow them in the order the round before
// gave. Every other item keeps its first-round place, worked out without the finalists.
//
// Ruling (M8 ticket 15): the finalists are those of the rounds actually held, never a tie worked
// out again from first-round counts. A reply deleted after a tie-break takes its votes with it,
// which could otherwise change who "was tied" and undo a result the hosts announced.
export function finalPlaces(first: Tally, rounds: HeldRound[]): Places {
  // How many rounds each finalist was held among: each round is among some of the round before's.
  const held = new Map<string, number>();
  rounds.forEach(({ finalists }, index) => {
    for (const id of finalists) if ((held.get(id) ?? 0) === index) held.set(id, index + 1);
  });
  const voted = [...first].filter(([, count]) => count > 0).map(([id]) => id);
  // Each item placed by the last round it was held in, and its votes there (the first round's for
  // an item no tie-break was held among, which needs a vote to be placed at all).
  const ranked = [...new Set([...held.keys(), ...voted])].map((id) => {
    const heldIn = held.get(id) ?? 0;
    return { id, heldIn, votes: (heldIn === 0 ? first : rounds[heldIn - 1].counts).get(id) ?? 0 };
  });
  const ahead = (other: (typeof ranked)[number], item: (typeof ranked)[number]) => other.heldIn > item.heldIn || (other.heldIn === item.heldIn && other.votes > item.votes);
  return new Map(ranked.map((item) => [item.id, 1 + ranked.filter((other) => ahead(other, item)).length]));
}

// An award's places as they stand: the first round's, then each tie-break round's in turn up to
// the award's current round, which is left out while its tie-break is still being voted in.
// `present` are the items the award may place (placeable): a finalist deleted since, or whose
// uploader's reply was deleted, is placed no more, and the places are those of the items still
// here (M8 ticket 15).
export function awardPlaces(award: AwardRules, votes: GivenVote[], present: string[]): Places {
  const last = award.tiebreakOpen ? award.round - 1 : award.round;
  const here = new Set(present);
  const rounds = tiebreakRounds(award.finalists)
    .slice(0, Math.max(0, last - 1))
    .map((finalists, index): HeldRound => ({ finalists: finalists.filter((id) => here.has(id)), counts: tally(votes, index + 2) }));
  return finalPlaces(tally(votes, 1), rounds);
}

// The items an award may place: approved, and in what it takes votes for, as countedVotes counts
// their votes.
export function placeable(award: Pick<AwardRules, "scope">, items: VotableItem[]): string[] {
  return items.filter((item) => item.status === "approved" && inScope(award, item)).map((item) => item.id);
}

// Whether any award has held a tie-break, open or closed (the voting part's review, finding 1):
// reopening the vote then ends it and deletes its votes, so the host is asked first, and a press
// not asked is refused (repository.ts, reopenVoting).
export function tiebreakHeld(awards: Pick<AwardRules, "round">[]): boolean {
  return awards.some((award) => award.round > 1);
}

// Whether the host is offered a tie-break: on the results, while first is shared and the host has
// not settled on sharing it. After a tie-break, another round is among the items of the last one
// still level (M8 ticket 15): none is offered for a tie it was not held among, which only the
// deletion of every one of its finalists leaves.
export function tiebreakOffered(stage: AwardStage, award: Pick<AwardRules, "sharedFirst" | "round" | "finalists">, placed: Places): boolean {
  const tied = tiedForFirst(placed);
  if (stage !== "results" || award.sharedFirst || tied.length === 0) return false;
  const last = roundFinalists(award);
  return award.round === 1 || tied.every((id) => last.includes(id));
}

// Whether the hosts are told that a tie-break's items are gone (review fix, M8 ticket 15): on the
// results, after a tie-break, while the items now level at the top were not among its last round,
// which only the deletion of every one of that round's finalists leaves. No other round is offered
// then (tiebreakOffered), and Reopen voting starts afresh.
export function finalistsGone(stage: AwardStage, award: Pick<AwardRules, "sharedFirst" | "round" | "finalists">, placed: Places): boolean {
  return stage === "results" && !award.sharedFirst && award.round > 1 && tiedForFirst(placed).length > 0 && !tiebreakOffered(stage, award, placed);
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

// The order this viewer's album lists an award's items in (M8 ticket 16): a guest's own while the
// award is voted in, a tie-break's included, so an early upload has no advantage (shuffledFor,
// keyed by their reply, so it is the same on every device that holds it); a host's, and everyone's
// once the results are in, the album's own.
export function orderFor(stage: AwardStage, viewer: VotingViewer, ids: string[]): string[] {
  return viewer.kind === "guest" && (stage === "voting" || stage === "tiebreak") ? shuffledFor(viewer.rsvpId, ids) : ids;
}

// "Whole album" in the album's award picker (the voting part's review, finding 2): every item the
// viewer's album has, with no star, count or ribbon, under a key in the page's query (`?award=all`)
// that no award's id, a UUID, can be.
export const WHOLE_ALBUM = "all";

// Whether the picker offers Whole album: whenever no award's list is the whole of the viewer's
// album (`album`, its ids), so that what an award leaves out (a tie-break's other items, the videos
// of an award for photos only, a pending item) is never out of reach, for hosts approving and
// deleting as for guests.
export function wholeAlbumOffered(lists: string[][], album: string[]): boolean {
  return !lists.some((list) => {
    const listed = new Set(list);
    return album.every((id) => listed.has(id));
  });
}

// The order Whole album lists the album in: the order each award's list takes (orderFor), a guest's
// own while any award is voted in, a tie-break's included, so it keeps the shuffle's fairness; the
// album's own otherwise.
export function wholeAlbumOrder(stages: AwardStage[], viewer: VotingViewer, ids: string[]): string[] {
  return orderFor(stages.find((stage) => stage === "voting" || stage === "tiebreak") ?? "results", viewer, ids);
}

// One of an award's winners (M8 ticket 16): an item in first to third place, with its votes.
export type Winner = { id: string; place: 1 | 2 | 3; votes: number };

// An award's winners, as the Winners strip shows them: the items in first to third place, more on
// ties, by place, a shared place by the higher count first, and otherwise in the order `placed`
// gives them (the sort keeps it).
export function winnersOf(placed: Places, votes: Tally): Winner[] {
  return [...placed]
    .flatMap(([id, place]): Winner[] => {
      const shown = ribbon(place);
      return shown ? [{ id, place: shown, votes: votes.get(id) ?? 0 }] : [];
    })
    .sort((a, b) => a.place - b.place || b.votes - a.votes);
}

// The number the album gives an item in the list `ids` (M8 ticket 16): one more than the items
// before it that open in the viewer, which a video still processing, or one that failed, does not
// (themes/sections/album.tsx numbers what opens); a photo waiting for approval opens.
export function itemNumber(ids: string[], items: VotableItem[], id: string): number {
  const byId = new Map(items.map((item) => [item.id, item]));
  const opens = (each: string) => {
    const item = byId.get(each);
    return item !== undefined && item.status !== "processing" && item.status !== "failed";
  };
  return 1 + ids.slice(0, Math.max(0, ids.indexOf(id))).filter(opens).length;
}

// The award a host's change names among the event's, by its id; or for null, Favourite before it
// was made, which the Voting block shows while the event has no award, only while the first award
// is still that unnamed one (as it is when made just now). A tab drawn before any award existed,
// used after another tab named Favourite or put another award first, is refused rather than
// renaming or re-scoping that other award (the voting part's review, finding 6).
export function awardNamed<T extends Pick<AwardRules, "id" | "name">>(awards: T[], awardId: string | null): T | undefined {
  if (awardId !== null) return awards.find((award) => award.id === awardId);
  return awards[0]?.name === null ? awards[0] : undefined;
}

// An event's awards, or Favourite alone while it has none (M8 plan, ruling 19).
export function awardsOrDefault(awards: AwardRules[]): AwardRules[] {
  return awards.length > 0 ? awards : [DEFAULT_AWARD];
}

// The awards the Voting block suggests (M8 ticket 13), each added with what it is for. A
// suggestion is stored as words in the language of the host who chose it, as a name they type is
// (M8 plan), so only the key is here; the block translates it.
export const SUGGESTED_AWARDS: readonly { key: "bestPhoto" | "bestVideo" | "funniest" | "groupShot"; scope: AwardScope }[] = [
  { key: "bestPhoto", scope: "photos" },
  { key: "bestVideo", scope: "videos" },
  { key: "funniest", scope: "all" },
  { key: "groupShot", scope: "photos" },
];

// An award's name as the host typed it, trimmed: null for nothing, which shows as the translated
// "Favourite", and refused past MAX_AWARD_NAME characters, counted by code point as the database's
// char_length counts them.
export function parseAwardName(posted: string): { ok: true; name: string | null } | { ok: false; error: "nameTooLong" } {
  const name = posted.trim();
  if ([...name].length > MAX_AWARD_NAME) return { ok: false, error: "nameTooLong" };
  return { ok: true, name: name === "" ? null : name };
}

// The awards' ids in their order once `id` is moved one place up (-1) or down (1): unchanged at
// either end, or for an id not among them.
export function movedAwards(ids: string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const moved = [...ids];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
}

// The votes that count (M8 ticket 13): each in one of these awards, for an item still here and
// approved, in its award's scope. A vote for an item its award no longer takes, since the host
// changed what the award is for, is kept but counts for nothing and is not its voter's; changing
// the scope back counts it again (M8 plan). The one place that decides it, for the tallies, the
// places, the viewer's own vote and the hosts' totals alike.
export function countedVotes<T extends GivenVote & { awardId: string }>(votes: T[], awards: AwardRules[], items: VotableItem[]): T[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const awardsById = new Map(awards.map((award) => [award.id, award]));
  return votes.filter((vote) => {
    const award = awardsById.get(vote.awardId);
    const item = itemsById.get(vote.photoId);
    return award !== undefined && item !== undefined && item.status === "approved" && inScope(award, item);
  });
}

// One award's counted votes and its places among the items it may place (placeable): the one
// place the album, the hosts' tie-break steps and the winners draft get them from (the voting
// part's review, finding 11), so that they cannot disagree.
export function countedPlaces<T extends GivenVote & { awardId: string }>(award: AwardRules, votes: T[], items: VotableItem[]): { counted: T[]; placed: Places } {
  const counted = countedVotes(
    votes.filter((vote) => vote.awardId === award.id),
    [award],
    items,
  );
  return { counted, placed: awardPlaces(award, counted, placeable(award, items)) };
}

// A vote as the album reads it (repository.ts, listVotes): in which award and round, for which
// item, and by whom, a guest through their RSVP or a host.
export type CastVote = GivenVote & { awardId: string; rsvpId: string | null; hostId: string | null };

// What one item shows of one award: whether this viewer may vote for it now, its votes where this
// viewer is shown them (the first round's, 0 included, or during a tie-break, for hosts, its
// round's), its ribbon once the award's results are in, and then, for a finalist of the last
// tie-break round, its votes there (M8 ticket 15). A key left out is not sent: a guest's page
// carries no count while voting is open, nor during a tie-break (M8 spec).
export type ItemStanding = { may: boolean; shownVotes?: number; place?: 1 | 2 | 3; tiebreakVotes?: number };

// Where one award stands for this viewer (M8 ticket 12): its stage, the items it lists (those in
// its scope, in the album's order; during a tie-break, its round's finalists still here), this
// viewer's vote in its current round (on the results, in the last round they voted in: review fix,
// ticket 15), for a host the votes given in that round so far, and what each item it lists shows.
// How many items share first (ticket 15): during a tie-break, those it is among; on the results,
// those a tie-break would be among. For a host, whether one is offered, and whether the last
// round's finalists are all gone (finalistsGone).
export type AwardStanding = {
  award: AwardRules;
  stage: AwardStage;
  ids: string[];
  voted: string | null;
  total?: number;
  tied: number;
  offered?: boolean;
  finalistsGone?: boolean;
  items: Map<string, ItemStanding>;
};

// Each award as this viewer's album shows it, from the event's votes and the items this viewer
// sees (`view`, the album's own answer). Only the votes countedVotes keeps count, so a vote for an
// item an award no longer shows is kept but not counted, nor shown as its voter's, who may vote
// again (M8 plan, ruling 23; ticket 13).
export function albumVotes(event: VotingEvent, view: AlbumViewName, viewer: VotingViewer, now: Date, awards: AwardRules[], votes: CastVote[], items: VotableItem[]): AwardStanding[] {
  const state = votingState(event, now);
  const votesHere = mayVote(event, view, viewer, now);
  const mine = (vote: CastVote) => (viewer.kind === "guest" ? vote.rsvpId === viewer.rsvpId : viewer.kind === "host" && vote.hostId === viewer.hostId);
  return awards.map((award) => {
    const stage = awardStage(state, award);
    const present = placeable(award, items);
    // During a tie-break the award lists its round's finalists alone (M8 ticket 15).
    const finalists = stage === "tiebreak" ? new Set(roundFinalists(award).filter((id) => present.includes(id))) : undefined;
    const listed = items.filter((item) => inScope(award, item) && (!finalists || finalists.has(item.id)));
    const ids = listed.map((item) => item.id);
    const { counted: given, placed: allPlaced } = countedPlaces(award, votes, items);
    const round = openRound(event, award, now);
    // The first round's counts, or during a tie-break its own round's, which only hosts are shown.
    const counts = tally(given, stage === "tiebreak" ? award.round : 1);
    const shown = countsShown(stage, viewer);
    const placed = stage === "results" ? allPlaced : undefined;
    // Each finalist's votes in the last tie-break round, once it is closed.
    const lastRound = placed && award.round > 1 ? { finalists: roundFinalists(award), counts: tally(given, award.round) } : undefined;
    const standings = new Map(
      listed.map((item): [string, ItemStanding] => {
        const place = placed && ribbon(placed.get(item.id));
        return [
          item.id,
          {
            may: votesHere && round !== null && mayVoteFor(award, item, viewer),
            ...(shown && { shownVotes: counts.get(item.id) ?? 0 }),
            ...(place && { place }),
            ...(lastRound?.finalists.includes(item.id) && { tiebreakVotes: lastRound.counts.get(item.id) ?? 0 }),
          },
        ];
      }),
    );
    // On the results nobody votes, and the vote shown (the picker's check) is the viewer's in the
    // last round they voted in, so a guest who sat out a tie-break still reads as having voted in
    // the award (review fix, ticket 15). Otherwise it is theirs in the award's current round.
    const theirs = given.filter(mine);
    const voted = (stage === "results" ? theirs.reduce<CastVote | undefined>((last, vote) => (last && last.round >= vote.round ? last : vote), undefined) : theirs.find((vote) => vote.round === award.round))?.photoId ?? null;
    const total = viewer.kind === "host" ? given.filter((vote) => vote.round === award.round).length : undefined;
    const tied = finalists ? finalists.size : placed ? tiedForFirst(placed).length : 0;
    const hosts = viewer.kind === "host" ? { offered: placed !== undefined && tiebreakOffered(stage, award, placed), finalistsGone: placed !== undefined && finalistsGone(stage, award, placed) } : {};
    return { award, stage, ids, voted, ...(total !== undefined && { total }), tied, ...hosts, items: standings };
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

// A press's answer come in, over the drawing shown now: one press fewer on its way, and the choice
// held over that drawing. A refusal, or an answer that never came, forgets the choice only once no
// press is on its way: a later press's choice stays until its own answer (review fix, M8 ticket 13).
export function voteAnswered(pending: PendingVote | undefined, refused: boolean, drawn: string): PendingVote | undefined {
  if (!pending) return undefined;
  const sending = Math.max(0, pending.sending - 1);
  return refused && sending === 0 ? undefined : { choice: pending.choice, drawn, sending };
}
