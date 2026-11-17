import { getLocale, getTranslations } from "next-intl/server";
import { formatMoment } from "@/events/time";
import { featureOn, siteFeatures } from "@/features";
import type { AlbumSlot } from "@/themes/sections/album";
import { AlbumVotingHead } from "./album-voting-head";
import { listAwards, listVotes, withInvite } from "./repository";
import { ItemVote, ViewerVote, type ItemAward } from "./vote-star";
import {
  albumVotes,
  awardsOrDefault,
  itemNumber,
  mayVote,
  nameShownTo,
  openRound,
  orderFor,
  votingState,
  WHOLE_ALBUM,
  wholeAlbumOffered,
  wholeAlbumOrder,
  winnersOf,
  type AlbumViewName,
  type AwardStanding,
  type Places,
  type ViewerWithoutInvite,
  type VotableItem,
  type VotingEvent,
  type VotingState,
} from "./voting";
import type { StripWinner } from "./winners-strip";

// What the album vote gives the album's drawing on the server (M8 ticket 11): the vote's state, and
// whether this viewer is shown who added each item. The album's one hook into the module, called
// once per page by the event page's albumFor. While there is a vote, an album that shows this
// viewer every item is also given its slot (ticket 12): the head above the grid, each item's star
// and badges on its tile and in the viewer, and each award's list of items. The head says when
// voting closes by itself, in the event's zone, and why a viewer who sees the album may not vote
// (ticket 14). During an award's tie-break its list is the round's finalists, and each item's
// standing what the round shows; once closed, a finalist's votes in it (ticket 15). While an award
// is voted in, a guest's list is in an order of their own (ticket 16); once its results are in,
// the head shows its winners, each with its picture and its label. Whenever no award's list is the
// whole of this viewer's album, one more list, Whole album, holds every item, with no star, count
// or ribbon, so that nothing an award leaves out is out of reach; and the closing time names its
// zone (the voting part's review).
export type AlbumVoting = { state: VotingState; showsName: (item: Pick<VotableItem, "rsvpId" | "hostId">) => boolean; slot?: AlbumSlot };

// One item as the album hands it to the vote (ticket 16): its thumbnail's address, built by the
// album, or null while a video is processing or failed; and who added it, which the hook passes on
// only where showsName does, before anything is sent.
export type AlbumVotingItem = VotableItem & { thumb: string | null; name: string };

// `items` are the items this viewer sees, in the album's order.
export type AlbumVotingInput = {
  event: VotingEvent & { id: string; slug: string; timeZone: string };
  viewer: ViewerWithoutInvite;
  view: AlbumViewName;
  items: AlbumVotingItem[];
  now: Date;
};

// The key an award goes by in the album's query and lists. Favourite has no row only while the vote
// is off (repository.ts, ensureAwards), when there is no slot.
const keyOf = (standing: AwardStanding) => standing.award.id ?? "";

// Cheap while the operator has Voting switched off: nothing is read, and every name shows, as it
// did before 0.8 (M8 plan). Otherwise the names as the host chose, and while the event has a vote,
// its awards and votes; the guest's reply is read for whether it came through a personal invite
// only then (ticket 12).
export async function albumVotingFor({ event, viewer, view, items, now }: AlbumVotingInput): Promise<AlbumVoting> {
  if (!featureOn(await siteFeatures(), "voting")) return { state: "off", showsName: () => true };
  const state = votingState(event, now);
  const showsName = nameShownTo(true, event, viewer, now);
  if (state === "off" || view !== "open") return { state, showsName };

  const [voter, awards, votes, t, labels, locale] = await Promise.all([
    withInvite(viewer),
    listAwards(event.id),
    listVotes(event.id),
    getTranslations("Voting"),
    getTranslations("EventPage.album"),
    getLocale(),
  ]);
  // Each award's list in this viewer's order (orderFor), by the award's own stage, so a guest's
  // shuffle covers the open vote and a tie-break's finalists alike.
  const standings = albumVotes(event, view, voter, now, awardsOrDefault(awards), votes, items).map((standing) => ({ ...standing, ids: orderFor(standing.stage, voter, standing.ids) }));
  const votesHere = mayVote(event, view, voter, now);
  // A guest who sees the whole album but is not among those the host lets vote is told why.
  const notAmong = voter.kind === "guest" && !votesHere && event.albumVoters !== "album" ? (event.albumVoters === "going" ? "onlyGoing" : "onlyInvited") : undefined;
  const closesAt = state === "open" && event.albumVotingClosesAt ? formatMoment(event.albumVotingClosesAt, event.timeZone, locale, { zone: true }) : undefined;
  const initial = keyOf(standings[0]);
  // Whole album, where it is offered, in the order each award's list takes.
  const albumIds = items.map(({ id }) => id);
  const whole = wholeAlbumOffered(
    standings.map(({ ids }) => ids),
    albumIds,
  );
  // This drawing of the page, told apart from every other: a star's press is shown over it until
  // the next drawing, which carries the vote as the site holds it (vote-star.tsx).
  const drawn = crypto.randomUUID();
  const byId = new Map(items.map((item) => [item.id, item]));
  // An award's winners on its results, for the strip: each item placed first to third (its ribbon)
  // with its first round's votes, in the award's list's order; labelled as the album labels its
  // thumbnail in that list, with who added it only where this viewer is shown that.
  const winnersIn = (standing: AwardStanding): StripWinner[] => {
    const placed: Places = new Map(
      standing.ids.flatMap((id): [string, number][] => {
        const place = standing.items.get(id)?.place;
        return place ? [[id, place]] : [];
      }),
    );
    const counts = new Map(standing.ids.map((id) => [id, standing.items.get(id)?.shownVotes ?? 0]));
    return winnersOf(placed, counts).map((winner) => {
      const item = byId.get(winner.id)!;
      const n = itemNumber(standing.ids, items, winner.id);
      const video = item.kind === "video";
      const label = showsName(item) ? labels(video ? "openVideo" : "open", { n, name: item.name }) : labels(video ? "openVideoUnnamed" : "openUnnamed", { n });
      // A finalist's votes in the last tie-break, which decided its place (the voting part's review).
      const tiebreakVotes = standing.items.get(winner.id)?.tiebreakVotes;
      return { ...winner, ...(tiebreakVotes !== undefined && { tiebreakVotes }), thumb: item.thumb, alt: t("album.winners.alt", { place: t("album.place", { place: winner.place }), label }) };
    });
  };
  // Each item's standing in every award that lists it.
  const awardsOf = (item: VotableItem): ItemAward[] =>
    standings.flatMap((standing) => {
      const shown = standing.items.get(item.id);
      return shown ? [{ award: keyOf(standing), voted: standing.voted, round: openRound(event, standing.award, now), drawn, ...shown }] : [];
    });
  const head = (
    <AlbumVotingHead
      awards={standings.map((standing) => ({
        award: keyOf(standing),
        name: standing.award.name ?? t("favourite"),
        scope: standing.award.scope,
        stage: standing.stage,
        round: standing.award.round,
        tied: standing.tied,
        voted: standing.voted,
        drawn,
        ...(standing.total !== undefined && { total: standing.total }),
        ...(standing.offered !== undefined && { offered: standing.offered }),
        ...(standing.finalistsGone && { finalistsGone: true }),
        ...(standing.stage === "results" && { winners: winnersIn(standing) }),
      }))}
      initial={initial}
      whole={whole}
      mayVote={votesHere}
      {...(notAmong && { notAmong })}
      {...(closesAt && { closesAt })}
      {...(voter.kind === "host" && { eventId: event.id })}
    />
  );
  return {
    state,
    showsName,
    slot: {
      head,
      tile: Object.fromEntries(items.map((item) => [item.id, <ItemVote key={item.id} slug={event.slug} item={item.id} initial={initial} whole={whole} awards={awardsOf(item)} />])),
      viewer: Object.fromEntries(items.map((item) => [item.id, <ViewerVote key={item.id} slug={event.slug} item={item.id} kind={item.kind} initial={initial} whole={whole} awards={awardsOf(item)} />])),
      lists: {
        param: "award",
        initial,
        ids: {
          ...Object.fromEntries(standings.map((standing) => [keyOf(standing), standing.ids])),
          ...(whole && {
            [WHOLE_ALBUM]: wholeAlbumOrder(
              standings.map(({ stage }) => stage),
              voter,
              albumIds,
            ),
          }),
        },
      },
    },
  };
}
