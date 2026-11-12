import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { HostEvent } from "@/events/repository";
import { formatMoment, toWallTime } from "@/events/time";
import { featureOn, siteFeatures } from "@/features";
import { listAwards } from "./repository";
import { albumOpenTo, awardsOrDefault, tiebreakHeld, votingState } from "./voting";
import { VotingBlock } from "./voting-block";

// The album vote's place in the editor's Settings sheet (M8 ticket 10): the Voting block, with the
// vote as it stands, whether the album is open for it to start, and whether guests see who added
// each item (ticket 11); the awards (ticket 13), Favourite alone while none is made, each with its
// name as shown (the translated "Favourite" for none); and who may vote and the closing time, in
// the event's zone (ticket 14); and whether a tie-break has been held, which Reopen voting then ends
// after asking (the voting part's review). The votes a confirmation deletes are read as it opens.
// Nothing while the operator has Voting, or the Album it needs, switched off.
export async function VotingSettings({ event }: { event: HostEvent }): Promise<ReactNode> {
  if (!featureOn(await siteFeatures(), "voting")) return null;
  const now = new Date();
  const [awards, t, locale] = await Promise.all([listAwards(event.id), getTranslations("Voting"), getLocale()]);
  const shown = awardsOrDefault(awards).map((award) => ({ id: award.id, name: award.name ?? t("favourite"), scope: award.scope }));
  const closesAt = event.albumVotingClosesAt;
  return (
    <VotingBlock
      eventId={event.id}
      state={votingState(event, now)}
      tiebreak={tiebreakHeld(awards)}
      albumOpen={albumOpenTo(event, { kind: "host", hostId: event.hostId }, now)}
      awards={shown}
      names={event.albumUploaderNames}
      voters={event.albumVoters}
      closing={{
        wall: closesAt && toWallTime(closesAt, event.timeZone),
        shown: closesAt && formatMoment(closesAt, event.timeZone, locale),
        timeZone: event.timeZone,
      }}
    />
  );
}
