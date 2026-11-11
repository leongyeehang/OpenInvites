import type { ReactNode } from "react";
import type { HostEvent } from "@/events/repository";
import { featureOn, siteFeatures } from "@/features";
import { countVotes } from "./repository";
import { albumOpenTo, votingState } from "./voting";
import { VotingBlock } from "./voting-block";

// The album vote's place in the editor's Settings sheet (M8 ticket 10): the Voting block, with the
// vote as it stands, whether the album is open for it to start, and how many votes turning it off
// deletes. Nothing while the operator has Voting, or the Album it needs, switched off.
export async function VotingSettings({ event }: { event: HostEvent }): Promise<ReactNode> {
  if (!featureOn(await siteFeatures(), "voting")) return null;
  const now = new Date();
  const votes = await countVotes(event.id);
  return <VotingBlock eventId={event.id} state={votingState(event, now)} albumOpen={albumOpenTo(event, { kind: "host", hostId: event.hostId }, now)} votes={votes} />;
}
