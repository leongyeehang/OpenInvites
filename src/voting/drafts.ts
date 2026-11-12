import type { HostEvent } from "@/events/repository";
import { eventUrl } from "@/events/slug";
import { formatMoment } from "@/events/time";
import { featureOn, siteFeatures } from "@/features";
import { translatorFor } from "@/locale/messages";
import { defaultLocale, isLocale } from "@/locale/resolve-locale";
import type { SavedStatus } from "@/rsvps/form";
import { votingDraftText, winnersDraftText, type WinnersLine } from "./draft-text";
import { listAwards, listNamedItems, listVotes } from "./repository";
import { awardsOrDefault, countedPlaces, draftAudience, namesShown, tally, votingState, winnersOf, type Places, type ViewerWithoutInvite } from "./voting";

// The announcements the album vote writes for the host (M8 ticket 14): "voting", that the vote is
// open, and "winners", each award's first place once it has closed (ticket 16). The Announcements
// page asks for one by `?draft=` (M8 plan, ruling 26) and starts its form with it, for the host to
// change and send; nothing is sent here.
export type VotingDraftKind = "voting" | "winners";

// Anyone who did not add the item: whom the winners draft may name an uploader to.
const A_GUEST: ViewerWithoutInvite = { kind: "visitor" };

// The draft `kind` names, written in the host's language as "Send a reminder now" is
// (draft-text.ts). "voting", while the vote is open: the event's title, its awards' names, the
// closing time in the event's zone, with the zone named (the voting part's review), when one is
// set, and the event link; emailed at first to Going alone when only guests who are going may vote
// or see the album (draftAudience). "winners", once the vote has closed and no award is in a
// tie-break: each award's first place from the votes that count (countedPlaces, so a closed
// tie-break's order holds), named by kind, and by who added it only where a guest would be shown
// that once voting has closed (under "Never shown to guests", no one, though the host writing it
// sees every name); emailed to the form's usual audience. Undefined for a kind it does not know,
// and while Voting is switched off for the site.
export async function votingDraft(event: HostEvent, kind: string | undefined, locale: string): Promise<{ body: string; audience?: SavedStatus[] } | undefined> {
  if ((kind !== "voting" && kind !== "winners") || !featureOn(await siteFeatures(), "voting")) return undefined;
  const state = votingState(event, new Date());
  if (state !== (kind === "voting" ? "open" : "closed")) return undefined;
  const [awards, t] = await Promise.all([listAwards(event.id), translatorFor(isLocale(locale) ? locale : defaultLocale)]);
  const rules = awardsOrDefault(awards);
  const nameOf = (award: (typeof rules)[number]) => award.name ?? t("Voting.favourite");
  const url = eventUrl(event);

  if (kind === "voting") {
    const closesAt = event.albumVotingClosesAt;
    const body = votingDraftText(t, locale, { title: event.title, awards: rules.map(nameOf), closes: closesAt ? formatMoment(closesAt, event.timeZone, locale, { zone: true }) : null, url });
    const audience = draftAudience(event);
    return { body, ...(audience && { audience }) };
  }

  if (rules.some((award) => award.tiebreakOpen)) return undefined;
  const [votes, items] = await Promise.all([listVotes(event.id), listNamedItems(event.id)]);
  const lines = rules.map((award): WinnersLine => {
    const { counted: given, placed } = countedPlaces(award, votes, items);
    // Items sharing first are listed in the order they were added.
    const ordered: Places = new Map(items.flatMap(({ id }): [string, number][] => (placed.has(id) ? [[id, placed.get(id)!]] : [])));
    const first = winnersOf(ordered, tally(given, 1)).filter((winner) => winner.place === 1);
    const winners = first.map(({ id }) => {
      const item = items.find((each) => each.id === id)!;
      return { kind: item.kind, name: namesShown(event, "closed", A_GUEST, item) ? item.name : null };
    });
    return { award: nameOf(award), winners, votes: first[0]?.votes ?? 0 };
  });
  return { body: winnersDraftText(t, locale, { title: event.title, lines, url }) };
}
