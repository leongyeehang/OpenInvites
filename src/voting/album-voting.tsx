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
  mayVote,
  nameShownTo,
  votingState,
  type AlbumViewName,
  type AwardStanding,
  type ViewerWithoutInvite,
  type VotableItem,
  type VotingEvent,
  type VotingState,
} from "./voting";

// What the album vote gives the album's drawing on the server (M8 ticket 11): the vote's state, and
// whether this viewer is shown who added each item. The album's one hook into the module, called
// once per page by the event page's albumFor. While there is a vote, an album that shows this
// viewer every item is also given its slot (ticket 12): the head above the grid, each item's star
// and badges on its tile and in the viewer, and each award's list of items. The head says when
// voting closes by itself, in the event's zone, and why a viewer who sees the album may not vote
// (ticket 14).
export type AlbumVoting = { state: VotingState; showsName: (item: Pick<VotableItem, "rsvpId" | "hostId">) => boolean; slot?: AlbumSlot };

// `items` are the items this viewer sees, in the album's order.
export type AlbumVotingInput = {
  event: VotingEvent & { id: string; slug: string; timeZone: string };
  viewer: ViewerWithoutInvite;
  view: AlbumViewName;
  items: VotableItem[];
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

  const [voter, awards, votes, t, locale] = await Promise.all([withInvite(viewer), listAwards(event.id), listVotes(event.id), getTranslations("Voting"), getLocale()]);
  const standings = albumVotes(event, view, voter, now, awardsOrDefault(awards), votes, items);
  const votesHere = mayVote(event, view, voter, now);
  // A guest who sees the whole album but is not among those the host lets vote is told why.
  const notAmong = voter.kind === "guest" && !votesHere && event.albumVoters !== "album" ? (event.albumVoters === "going" ? "onlyGoing" : "onlyInvited") : undefined;
  const closesAt = state === "open" && event.albumVotingClosesAt ? formatMoment(event.albumVotingClosesAt, event.timeZone, locale) : undefined;
  const initial = keyOf(standings[0]);
  // This drawing of the page, told apart from every other: a star's press is shown over it until
  // the next drawing, which carries the vote as the site holds it (vote-star.tsx).
  const drawn = crypto.randomUUID();
  // Each item's standing in every award that lists it.
  const awardsOf = (item: VotableItem): ItemAward[] =>
    standings.flatMap((standing) => {
      const shown = standing.items.get(item.id);
      return shown ? [{ award: keyOf(standing), voted: standing.voted, drawn, ...shown }] : [];
    });
  const head = (
    <AlbumVotingHead
      awards={standings.map((standing) => ({
        award: keyOf(standing),
        name: standing.award.name ?? t("favourite"),
        scope: standing.award.scope,
        stage: standing.stage,
        voted: standing.voted,
        drawn,
        ...(standing.total !== undefined && { total: standing.total }),
      }))}
      initial={initial}
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
      tile: Object.fromEntries(items.map((item) => [item.id, <ItemVote key={item.id} slug={event.slug} item={item.id} initial={initial} awards={awardsOf(item)} />])),
      viewer: Object.fromEntries(items.map((item) => [item.id, <ViewerVote key={item.id} slug={event.slug} item={item.id} kind={item.kind} initial={initial} awards={awardsOf(item)} />])),
      lists: { param: "award", initial, ids: Object.fromEntries(standings.map((standing) => [keyOf(standing), standing.ids])) },
    },
  };
}
