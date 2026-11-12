import { getTranslations } from "next-intl/server";
import type { HostEvent } from "@/events/repository";
import { eventUrl } from "@/events/slug";
import { formatMoment } from "@/events/time";
import { featureOn, siteFeatures } from "@/features";
import type { SavedStatus } from "@/rsvps/form";
import { listAwards } from "./repository";
import { awardsOrDefault, draftAudience, votingState } from "./voting";

// The announcements the album vote writes for the host (M8 ticket 14): "voting", that the vote is
// open; ticket 16 adds "winners". The Announcements page asks for one by `?draft=` (M8 plan,
// ruling 26) and starts its form with it, for the host to change and send; nothing is sent here.
export type VotingDraftKind = "voting" | "winners";

// The draft `kind` names, written in the host's language as "Send a reminder now" is: the event's
// title, its awards' names, the closing time in the event's zone when one is set, and the event
// link; emailed at first to Going alone when only guests who are going may vote. Undefined for a
// kind it does not know, while Voting is switched off for the site, and while the vote is not open.
export async function votingDraft(event: HostEvent, kind: string | undefined, locale: string): Promise<{ body: string; audience?: SavedStatus[] } | undefined> {
  if (kind !== "voting" || !featureOn(await siteFeatures(), "voting") || votingState(event, new Date()) !== "open") return undefined;
  const [awards, t, voting] = await Promise.all([listAwards(event.id), getTranslations("VotingDrafts"), getTranslations("Voting")]);
  const names = awardsOrDefault(awards).map((award) => award.name ?? voting("favourite"));
  const closesAt = event.albumVotingClosesAt;
  const body = t("voting", {
    title: event.title,
    awards: new Intl.ListFormat(locale, { type: "conjunction" }).format(names),
    closes: closesAt ? "yes" : "no",
    time: closesAt ? formatMoment(closesAt, event.timeZone, locale) : "",
    url: eventUrl(event),
  });
  const audience = draftAudience(event.albumVoters);
  return { body, ...(audience && { audience }) };
}
