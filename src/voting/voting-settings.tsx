import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { HostEvent } from "@/events/repository";
import { featureOn, siteFeatures } from "@/features";
import { countAwardVotes, listAwards } from "./repository";
import { albumOpenTo, awardsOrDefault, votingState } from "./voting";
import { VotingBlock } from "./voting-block";

// The album vote's place in the editor's Settings sheet (M8 ticket 10): the Voting block, with the
// vote as it stands, whether the album is open for it to start, and whether guests see who added
// each item (ticket 11); and the awards (ticket 13), Favourite alone while none is made, each with
// its name as shown (the translated "Favourite" for none) and the votes it holds, which removing
// it deletes. Nothing while the operator has Voting, or the Album it needs, switched off.
export async function VotingSettings({ event }: { event: HostEvent }): Promise<ReactNode> {
  if (!featureOn(await siteFeatures(), "voting")) return null;
  const now = new Date();
  const [awards, votes, t] = await Promise.all([listAwards(event.id), countAwardVotes(event.id), getTranslations("Voting")]);
  const shown = awardsOrDefault(awards).map((award) => ({
    id: award.id,
    name: award.name ?? t("favourite"),
    scope: award.scope,
    votes: award.id === null ? 0 : (votes.get(award.id) ?? 0),
  }));
  return (
    <VotingBlock
      eventId={event.id}
      state={votingState(event, now)}
      albumOpen={albumOpenTo(event, { kind: "host", hostId: event.hostId }, now)}
      awards={shown}
      names={event.albumUploaderNames}
    />
  );
}
