import { MAX_BODY } from "@/announcements/announcement";
import type { Translator } from "@/locale/messages";

// The words of the announcements the album vote writes for the host (M8 tickets 14 and 16; read
// and offered by drafts.ts), apart from what reads the event, so that they are tested as text.
// Each fits an announcement (MAX_BODY): a draft that would not is shortened, never refused at Send
// (review fix, ticket 14).

// The longest writing of a draft that fits an announcement: `write` with all `count` of its parts,
// then one fewer each time, from the end. Where not even none fits (a title near the limit alone),
// the text with none, cut to the limit, for the host to put right before sending.
function fitted(write: (shown: number) => string, count: number): string {
  for (let shown = count; shown >= 0; shown--) {
    const text = write(shown);
    if (text.length <= MAX_BODY) return text;
  }
  return write(0).slice(0, MAX_BODY);
}

// "Voting is open" (ticket 14): the event's title, its awards' names, the closing time as written
// for the host when one is set, and the event link. Names that do not fit are left out from the
// end, and the list says how many more there are.
export function votingDraftText(t: Translator, locale: string, draft: { title: string; awards: string[]; closes: string | null; url: string }): string {
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const { awards } = draft;
  return fitted((shown) => {
    const names = shown < awards.length ? [...awards.slice(0, shown), t("VotingDrafts.more", { count: awards.length - shown })] : awards;
    return t("VotingDrafts.voting", { title: draft.title, awards: list.format(names), closes: draft.closes ? "yes" : "no", time: draft.closes ?? "", url: draft.url });
  }, awards.length);
}

// One award's line in the winners draft (ticket 16): its name as displayed, its first place, each
// item by its kind and by who added it where a guest would be shown that (null otherwise), and the
// first place's votes in the first round; no item where nobody voted in it.
export type WinnersLine = { award: string; winners: { kind: "photo" | "video"; name: string | null }[]; votes: number };

// The winners (ticket 16): a line per award, in the awards' order, naming its first place by kind
// and uploader, never by number, since numbers follow the list a viewer sees and the message
// outlives the vote (M8 plan, ruling 28); then the event link. Lines that do not fit are left out
// from the end, and a last line says how many awards are left out (review fix, ticket 16), so the
// message never has an empty block between its title and its link: every count is in the album,
// which the message sends guests to.
export function winnersDraftText(t: Translator, locale: string, draft: { title: string; lines: WinnersLine[]; url: string }): string {
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const line = ({ award, winners, votes }: WinnersLine) =>
    winners.length === 0
      ? t("VotingDrafts.noVotes", { award })
      : t("VotingDrafts.line", {
          award,
          winners: list.format(winners.map(({ kind, name }) => t("VotingDrafts.item", { kind, named: name === null ? "no" : "yes", name: name ?? "" }))),
          count: votes,
          shared: winners.length > 1 ? "yes" : "no",
        });
  const left = (shown: number) => (shown < draft.lines.length ? [t("VotingDrafts.moreAwards", { count: draft.lines.length - shown })] : []);
  return fitted((shown) => t("VotingDrafts.winners", { title: draft.title, lines: [...draft.lines.slice(0, shown).map(line), ...left(shown)].join("\n"), url: draft.url }), draft.lines.length);
}
