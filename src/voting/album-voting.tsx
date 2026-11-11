import { featureOn, siteFeatures } from "@/features";
import { withInvite } from "./repository";
import { nameShownTo, votingState, type AlbumViewName, type ViewerWithoutInvite, type VotableItem, type VotingEvent, type VotingState } from "./voting";

// What the album vote gives the album's drawing on the server (M8 ticket 11): the vote's state, and
// whether this viewer is shown who added each item. The album's one hook into the module, called
// once per page by the event page's albumFor; tickets 12 onwards add what the album draws of the
// vote.
export type AlbumVoting = { state: VotingState; showsName: (item: Pick<VotableItem, "rsvpId" | "hostId">) => boolean };

export type AlbumVotingInput = {
  event: VotingEvent & { id: string; slug: string; timeZone: string };
  locale: string;
  viewer: ViewerWithoutInvite;
  view: AlbumViewName;
  now: Date;
};

// Cheap while the operator has Voting switched off: nothing is read, and every name shows, as it
// did before 0.8 (M8 plan). Otherwise the vote as it stands, and the names as the host chose.
export async function albumVotingFor({ event, viewer, now }: AlbumVotingInput): Promise<AlbumVoting> {
  if (!featureOn(await siteFeatures(), "voting")) return { state: "off", showsName: () => true };
  return { state: votingState(event, now), showsName: nameShownTo(true, event, await withInvite(viewer), now) };
}
