import { describe, expect, it } from "vitest";
import { albumAwardScope, albumUploaderNames, albumVoters, albumVotingState } from "@/db/schema";
import {
  albumOpenTo,
  AWARD_SCOPES,
  awardPlaces,
  awardsOrDefault,
  awardStage,
  countsShown,
  DEFAULT_AWARD,
  finalPlaces,
  inScope,
  mayVote,
  mayVoteFor,
  namesShown,
  nameShownTo,
  openRound,
  places,
  ribbon,
  shuffledFor,
  tally,
  tiebreakOffered,
  tiedForFirst,
  UPLOADER_NAMES,
  VOTING_STATES,
  votingState,
  WHO_MAY_VOTE,
  type AwardRules,
  type GivenVote,
  type Places,
  type Tally,
  type VotableItem,
  type VotingEvent,
  type VotingViewer,
} from "./voting";

// The album vote's rules (M8 ticket 10): who may vote and for what, the places, the tie-break's
// places, what is shown to whom, and the shuffle. Pure, so the later voting tickets draw on them.

const START = new Date("2027-05-08T11:00:00Z");
const NOW = new Date("2027-05-08T12:00:00Z");
const MINUTE = 60_000;

const event = (changes: Partial<VotingEvent> = {}): VotingEvent => ({
  state: "published",
  startsAt: START,
  albumVisibility: "replied",
  albumVoting: "open",
  albumVotingClosesAt: null,
  albumVoters: "album",
  albumUploaderNames: "afterVoting",
  ...changes,
});

const host: VotingViewer = { kind: "host", hostId: "h1" };
const coHost: VotingViewer = { kind: "host", hostId: "h2" };
const visitor: VotingViewer = { kind: "visitor" };
const guest = (
  status: "going" | "maybe" | "cant" | "waitlisted" = "going",
  approval: "approved" | "pending" | "declined" = "approved",
  invited = false,
): VotingViewer => ({ kind: "guest", rsvpId: "r1", approval, status, invited });

const award = (changes: Partial<AwardRules> = {}): AwardRules => ({ ...DEFAULT_AWARD, id: "a1", ...changes });
const item = (changes: Partial<VotableItem> = {}): VotableItem => ({ id: "p1", kind: "photo", status: "approved", rsvpId: "r2", hostId: null, ...changes });

const votes = (round: number, counts: Record<string, number>): GivenVote[] =>
  Object.entries(counts).flatMap(([photoId, count]) => Array.from({ length: count }, () => ({ photoId, round })));
const placed = (entries: Record<string, number>): Places => new Map(Object.entries(entries));
const counted = (entries: Record<string, number>): Tally => new Map(Object.entries(entries));

describe("votingState", () => {
  it("is off while the host has not started a vote", () => {
    expect(votingState(event({ albumVoting: "off" }), NOW)).toBe("off");
  });

  it("is open while open, with no closing time or one still ahead", () => {
    expect(votingState(event(), NOW)).toBe("open");
    expect(votingState(event({ albumVotingClosesAt: new Date(NOW.getTime() + MINUTE) }), NOW)).toBe("open");
  });

  it("is closed once the closing time has come, though nothing wrote it", () => {
    expect(votingState(event({ albumVotingClosesAt: NOW }), NOW)).toBe("closed");
    expect(votingState(event({ albumVotingClosesAt: new Date(NOW.getTime() - 60 * MINUTE) }), NOW)).toBe("closed");
  });

  it("is closed when the host closed it, whatever the time", () => {
    expect(votingState(event({ albumVoting: "closed" }), NOW)).toBe("closed");
    expect(votingState(event({ albumVoting: "closed", albumVotingClosesAt: new Date(NOW.getTime() + MINUTE) }), NOW)).toBe("closed");
  });
});

// The album's own rule (album/visibility.ts, albumView; album/album.ts, albumState), restated for
// the module's actions: these cases are visibility.test.ts's where the album is open.
describe("albumOpenTo", () => {
  it("opens to a host on a published event from its start", () => {
    expect(albumOpenTo(event(), host, START)).toBe(true);
  });

  it("is shut before the start, on a draft and on a cancelled event", () => {
    expect(albumOpenTo(event(), host, new Date(START.getTime() - 1))).toBe(false);
    expect(albumOpenTo(event({ state: "draft" }), host, NOW)).toBe(false);
    expect(albumOpenTo(event({ state: "cancelled" }), host, NOW)).toBe(false);
    expect(albumOpenTo(event({ startsAt: null }), host, NOW)).toBe(false);
  });

  it("opens to an approved guest under replied, whatever they said", () => {
    for (const status of ["going", "maybe", "cant", "waitlisted"] as const) expect(albumOpenTo(event(), guest(status), NOW)).toBe(true);
  });

  it("under going, opens to a Going guest only", () => {
    expect(albumOpenTo(event({ albumVisibility: "going" }), guest("going"), NOW)).toBe(true);
    for (const status of ["maybe", "cant", "waitlisted"] as const) expect(albumOpenTo(event({ albumVisibility: "going" }), guest(status), NOW)).toBe(false);
  });

  it("under hosts, opens to no guest", () => {
    expect(albumOpenTo(event({ albumVisibility: "hosts" }), guest("going"), NOW)).toBe(false);
    expect(albumOpenTo(event({ albumVisibility: "hosts" }), guest("maybe"), NOW)).toBe(false);
  });

  it("is shut to a pending or declined guest, and a visitor, in every mode", () => {
    for (const albumVisibility of ["replied", "going", "hosts"] as const) {
      expect(albumOpenTo(event({ albumVisibility }), guest("going", "pending"), NOW)).toBe(false);
      expect(albumOpenTo(event({ albumVisibility }), guest("going", "declined"), NOW)).toBe(false);
      expect(albumOpenTo(event({ albumVisibility }), visitor, NOW)).toBe(false);
    }
  });
});

describe("mayVote", () => {
  it("lets a host who sees the album vote, whoever else may", () => {
    for (const albumVoters of WHO_MAY_VOTE) expect(mayVote(event({ albumVoters }), "open", host, NOW)).toBe(true);
  });

  it("under album, lets every guest who sees the whole album vote", () => {
    expect(mayVote(event(), "open", guest("going"), NOW)).toBe(true);
    expect(mayVote(event(), "open", guest("maybe"), NOW)).toBe(true);
  });

  it("under going, lets Going guests vote, and not Maybe or a waitlisted reply", () => {
    expect(mayVote(event({ albumVoters: "going" }), "open", guest("going"), NOW)).toBe(true);
    expect(mayVote(event({ albumVoters: "going" }), "open", guest("maybe"), NOW)).toBe(false);
    expect(mayVote(event({ albumVoters: "going" }), "open", guest("waitlisted"), NOW)).toBe(false);
  });

  it("under invited, lets a guest who replied through an invite vote, and no other", () => {
    expect(mayVote(event({ albumVoters: "invited" }), "open", guest("going", "approved", true), NOW)).toBe(true);
    expect(mayVote(event({ albumVoters: "invited" }), "open", guest("going", "approved", false), NOW)).toBe(false);
  });

  it("refuses a guest shown only their own, and a visitor", () => {
    expect(mayVote(event(), "own", guest("going"), NOW)).toBe(false);
    expect(mayVote(event(), "locked", visitor, NOW)).toBe(false);
    expect(mayVote(event(), "open", visitor, NOW)).toBe(false);
  });

  it("refuses everyone while voting is off", () => {
    expect(mayVote(event({ albumVoting: "off" }), "open", host, NOW)).toBe(false);
    expect(mayVote(event({ albumVoting: "off" }), "open", guest("going"), NOW)).toBe(false);
  });

  it("still answers by the person once the vote is closed, since a tie-break is voted in then", () => {
    expect(mayVote(event({ albumVoting: "closed" }), "open", guest("going"), NOW)).toBe(true);
    expect(mayVote(event({ albumVoting: "closed", albumVoters: "going" }), "open", guest("maybe"), NOW)).toBe(false);
  });

  it("refuses everyone while the album itself is shut", () => {
    expect(mayVote(event({ state: "cancelled" }), "open", host, NOW)).toBe(false);
  });
});

describe("inScope", () => {
  it("takes photos and videos for all, and only its own kind otherwise", () => {
    expect(inScope({ scope: "all" }, { kind: "photo" })).toBe(true);
    expect(inScope({ scope: "all" }, { kind: "video" })).toBe(true);
    expect(inScope({ scope: "photos" }, { kind: "photo" })).toBe(true);
    expect(inScope({ scope: "photos" }, { kind: "video" })).toBe(false);
    expect(inScope({ scope: "videos" }, { kind: "photo" })).toBe(false);
    expect(inScope({ scope: "videos" }, { kind: "video" })).toBe(true);
  });
});

describe("mayVoteFor", () => {
  it("takes an approved item in the award's scope that someone else added", () => {
    expect(mayVoteFor(award(), item(), guest())).toBe(true);
    expect(mayVoteFor(award(), item(), host)).toBe(true);
  });

  it("takes no item that is pending, processing or failed", () => {
    for (const status of ["pending", "processing", "failed"] as const) expect(mayVoteFor(award(), item({ status }), guest())).toBe(false);
  });

  it("takes no item outside the award's scope", () => {
    expect(mayVoteFor(award({ scope: "photos" }), item({ kind: "video" }), guest())).toBe(false);
    expect(mayVoteFor(award({ scope: "videos" }), item({ kind: "photo" }), guest())).toBe(false);
  });

  it("takes nobody's vote for their own item, and a host's for a co-host's", () => {
    expect(mayVoteFor(award(), item({ rsvpId: "r1" }), guest())).toBe(false);
    expect(mayVoteFor(award(), item({ rsvpId: null, hostId: "h1" }), host)).toBe(false);
    expect(mayVoteFor(award(), item({ rsvpId: null, hostId: "h1" }), coHost)).toBe(true);
  });

  it("during a tie-break, takes only the finalists", () => {
    const tiebreak = award({ round: 2, finalists: ["p1", "p2"], tiebreakOpen: true });
    expect(mayVoteFor(tiebreak, item({ id: "p1" }), guest())).toBe(true);
    expect(mayVoteFor(tiebreak, item({ id: "p3" }), guest())).toBe(false);
  });

  it("takes no visitor's vote", () => {
    expect(mayVoteFor(award(), item(), visitor)).toBe(false);
  });
});

describe("awardStage and openRound", () => {
  it("follows the event's vote, and a tie-break while it is closed", () => {
    expect(awardStage("off", award())).toBe("off");
    expect(awardStage("open", award())).toBe("voting");
    expect(awardStage("closed", award({ round: 2, tiebreakOpen: true }))).toBe("tiebreak");
    expect(awardStage("closed", award())).toBe("results");
  });

  it("is round 1 while open, the award's round during a tie-break, and none otherwise", () => {
    expect(openRound(event(), award(), NOW)).toBe(1);
    expect(openRound(event({ albumVoting: "closed" }), award({ round: 2, finalists: ["p1", "p2"], tiebreakOpen: true }), NOW)).toBe(2);
    expect(openRound(event({ albumVoting: "closed" }), award(), NOW)).toBeNull();
    expect(openRound(event({ albumVoting: "off" }), award(), NOW)).toBeNull();
  });
});

describe("tally and places", () => {
  it("counts only the round asked for", () => {
    const given = [...votes(1, { a: 2, b: 1 }), ...votes(2, { a: 1, c: 3 })];
    expect(tally(given, 1)).toEqual(counted({ a: 2, b: 1 }));
    expect(tally(given, 2)).toEqual(counted({ a: 1, c: 3 }));
  });

  it("shares a place on a tie, and skips the places a tie takes", () => {
    expect(places(counted({ a: 12, b: 12, c: 9 }))).toEqual(placed({ a: 1, b: 1, c: 3 }));
    expect(places(counted({ a: 5, b: 3, c: 3, d: 1 }))).toEqual(placed({ a: 1, b: 2, c: 2, d: 4 }));
  });

  it("gives no place to an item with no vote, and none at all to an empty tally", () => {
    expect(places(counted({ a: 2, b: 0 }))).toEqual(placed({ a: 1 }));
    expect(places(new Map())).toEqual(new Map());
  });

  it("gives ribbons to the first three places", () => {
    expect([1, 2, 3, 4, undefined].map(ribbon)).toEqual([1, 2, 3, undefined, undefined]);
  });

  it("names the items sharing first, and none when one item is first", () => {
    expect(tiedForFirst(placed({ a: 1, b: 1, c: 3 }))).toEqual(["a", "b"]);
    expect(tiedForFirst(placed({ a: 1, b: 2 }))).toEqual([]);
  });
});

describe("finalPlaces", () => {
  const before = placed({ a: 1, b: 1, c: 3 });

  it("orders the items that shared first by the tie-break, in the places they shared", () => {
    expect(finalPlaces(before, counted({ b: 5, a: 3 }))).toEqual(placed({ a: 2, b: 1, c: 3 }));
  });

  it("leaves them sharing first when the tie-break is level too", () => {
    expect(finalPlaces(before, counted({ a: 4, b: 4 }))).toEqual(placed({ a: 1, b: 1, c: 3 }));
  });

  it("puts an item the tie-break gave no vote after the others", () => {
    expect(finalPlaces(before, counted({ b: 2 }))).toEqual(placed({ a: 2, b: 1, c: 3 }));
  });

  it("orders three among the places they shared, and leaves the rest where they were", () => {
    expect(finalPlaces(placed({ a: 1, b: 1, c: 1, d: 4 }), counted({ a: 3, b: 3, c: 1 }))).toEqual(placed({ a: 1, b: 1, c: 3, d: 4 }));
  });
});

describe("awardPlaces", () => {
  const given = [...votes(1, { a: 5, b: 5, c: 5, d: 1 }), ...votes(2, { a: 4, b: 4, c: 1 }), ...votes(3, { b: 2, a: 1 })];

  it("folds every round up to the award's own", () => {
    expect(awardPlaces(award({ round: 3 }), given)).toEqual(placed({ a: 2, b: 1, c: 3, d: 4 }));
  });

  it("leaves out the round whose tie-break is still open", () => {
    expect(awardPlaces(award({ round: 3, finalists: ["a", "b"], tiebreakOpen: true }), given)).toEqual(placed({ a: 1, b: 1, c: 3, d: 4 }));
  });

  it("is the first round's places for an award that never had a tie-break", () => {
    expect(awardPlaces(award(), given)).toEqual(placed({ a: 1, b: 1, c: 1, d: 4 }));
  });
});

describe("tiebreakOffered", () => {
  const shared = placed({ a: 1, b: 1, c: 3 });

  it("is offered on the results when first is shared and the host has not settled on sharing it", () => {
    expect(tiebreakOffered("results", award(), shared)).toBe(true);
  });

  it("is not offered once first is shared for good, during a tie-break, or with one first", () => {
    expect(tiebreakOffered("results", award({ sharedFirst: true }), shared)).toBe(false);
    expect(tiebreakOffered("tiebreak", award({ tiebreakOpen: true }), shared)).toBe(false);
    expect(tiebreakOffered("results", award(), placed({ a: 1, b: 2 }))).toBe(false);
  });
});

describe("countsShown", () => {
  it("shows a host the counts whenever there is a vote", () => {
    expect(countsShown("voting", host)).toBe(true);
    expect(countsShown("tiebreak", host)).toBe(true);
    expect(countsShown("results", host)).toBe(true);
    expect(countsShown("off", host)).toBe(false);
  });

  it("shows a guest the counts only with the results", () => {
    expect(countsShown("off", guest())).toBe(false);
    expect(countsShown("voting", guest())).toBe(false);
    expect(countsShown("tiebreak", guest())).toBe(false);
    expect(countsShown("results", guest())).toBe(true);
  });
});

describe("namesShown", () => {
  const theirs = item({ rsvpId: "r2" });

  it("always shows a host the names, and an uploader their own, under never too", () => {
    for (const albumUploaderNames of UPLOADER_NAMES) {
      for (const state of VOTING_STATES) {
        expect(namesShown(event({ albumUploaderNames }), state, host, theirs)).toBe(true);
        expect(namesShown(event({ albumUploaderNames }), state, guest(), item({ rsvpId: "r1" }))).toBe(true);
      }
    }
  });

  it("under always, shows names while voting is open", () => {
    expect(namesShown(event({ albumUploaderNames: "always" }), "open", guest(), theirs)).toBe(true);
  });

  it("under never, hides names whatever the vote", () => {
    for (const state of VOTING_STATES) expect(namesShown(event({ albumUploaderNames: "never" }), state, guest(), theirs)).toBe(false);
  });

  it("under afterVoting, hides names only while voting is open, so an event that never votes shows them", () => {
    expect(namesShown(event({ albumUploaderNames: "afterVoting" }), "open", guest(), theirs)).toBe(false);
    expect(namesShown(event({ albumUploaderNames: "afterVoting" }), "closed", guest(), theirs)).toBe(true);
    expect(namesShown(event({ albumUploaderNames: "afterVoting" }), "off", guest(), theirs)).toBe(true);
  });
});

describe("nameShownTo", () => {
  const theirs = item({ rsvpId: "r2" });
  const aCoHosts = item({ rsvpId: null, hostId: "h2" });

  it("with Voting off for the site, shows every item's name as before 0.8, under never with the vote open too (plan)", () => {
    const showsName = nameShownTo(false, event({ albumUploaderNames: "never", albumVoting: "open" }), guest(), NOW);
    expect(showsName(theirs)).toBe(true);
    expect(showsName(aCoHosts)).toBe(true);
    expect(nameShownTo(false, event({ albumUploaderNames: "never" }), visitor, NOW)(theirs)).toBe(true);
  });

  it("with Voting on, agrees with namesShown under afterVoting for a vote open, open past its closing time, and closed", () => {
    const cases: Partial<VotingEvent>[] = [
      { albumVoting: "open" },
      { albumVoting: "open", albumVotingClosesAt: new Date(NOW.getTime() - MINUTE) },
      { albumVoting: "closed" },
    ];
    for (const changes of cases) {
      const shown = event({ albumUploaderNames: "afterVoting", ...changes });
      for (const viewer of [host, coHost, guest(), visitor]) {
        for (const each of [theirs, aCoHosts, item({ rsvpId: "r1" })]) {
          expect(nameShownTo(true, shown, viewer, NOW)(each)).toBe(namesShown(shown, votingState(shown, NOW), viewer, each));
        }
      }
    }
  });

  it("with Voting on, hides names while the vote is open, and shows them once it reads closed by its time", () => {
    expect(nameShownTo(true, event({ albumUploaderNames: "afterVoting" }), guest(), NOW)(theirs)).toBe(false);
    expect(nameShownTo(true, event({ albumUploaderNames: "afterVoting" }), guest(), NOW)(aCoHosts)).toBe(false);
    const pastItsTime = event({ albumUploaderNames: "afterVoting", albumVotingClosesAt: new Date(NOW.getTime() - MINUTE) });
    expect(nameShownTo(true, pastItsTime, guest(), NOW)(theirs)).toBe(true);
  });

  it("shows a guest their own item's name under never", () => {
    expect(nameShownTo(true, event({ albumUploaderNames: "never" }), guest(), NOW)(item({ rsvpId: "r1" }))).toBe(true);
    expect(nameShownTo(true, event({ albumUploaderNames: "never" }), guest(), NOW)(theirs)).toBe(false);
  });
});

describe("shuffledFor", () => {
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

  it("gives one viewer the same order every time, of the same ids", () => {
    expect(shuffledFor("a", ids)).toEqual(shuffledFor("a", ids));
    expect([...shuffledFor("a", ids)].sort()).toEqual(ids);
  });

  it("gives two viewers different orders", () => {
    expect(shuffledFor("a", ids)).not.toEqual(shuffledFor("b", ids));
  });

  it("keeps the others in their order when an item is added", () => {
    expect(shuffledFor("a", [...ids, "p9"]).filter((id) => id !== "p9")).toEqual(shuffledFor("a", ids));
  });

  it("gives none for none", () => {
    expect(shuffledFor("a", [])).toEqual([]);
  });
});

describe("awardsOrDefault", () => {
  it("is Favourite alone for an event with no awards yet, and the awards otherwise", () => {
    expect(awardsOrDefault([])).toEqual([DEFAULT_AWARD]);
    const given = [award({ id: "a1", name: "Funniest", position: 0 }), award({ id: "a2", name: null, scope: "videos", position: 1 })];
    expect(awardsOrDefault(given)).toEqual(given);
  });
});

describe("the database's lists", () => {
  it("are the lists here", () => {
    expect(albumVotingState.enumValues).toEqual([...VOTING_STATES]);
    expect(albumVoters.enumValues).toEqual([...WHO_MAY_VOTE]);
    expect(albumUploaderNames.enumValues).toEqual([...UPLOADER_NAMES]);
    expect(albumAwardScope.enumValues).toEqual([...AWARD_SCOPES]);
  });
});
