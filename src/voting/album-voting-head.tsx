"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AwardPicker } from "./award-picker";
import { closeTiebreakAction, closeVotingAction, keepSharedFirstAction, reopenVotingAction, startTiebreakAction } from "./host-actions";
import { useChosen, useRefusal, useVote } from "./vote-star";
import type { AwardScope, AwardStage } from "./voting";
import { WinnersStrip, type StripWinner } from "./winners-strip";

// One award as the head shows it: its name as displayed, what it is for, where it stands and its
// round, how many items share first (voting.ts, AwardStanding), this viewer's vote in it (the item
// voted for, or none), the page's drawing (vote-star.tsx, ItemAward), and for hosts the votes given
// so far, whether a tie-break is offered, and whether the last one's items are all gone; on the
// results, its winners (ticket 16).
export type HeadAward = {
  award: string;
  name: string;
  scope: AwardScope;
  stage: AwardStage;
  round: number;
  tied: number;
  voted: string | null;
  drawn: string;
  total?: number;
  offered?: boolean;
  finalistsGone?: boolean;
  winners?: StripWinner[];
};

// A link in the hosts' box, ringed when it has the focus (keyboard pass, M8 ticket 16).
const HOSTS_LINK = "self-start rounded-sm text-sm underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text";

const HOSTS_BUTTON =
  "inline-flex h-9 cursor-pointer items-center self-start rounded-full bg-theme-glass-strong px-4 text-sm font-medium hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text disabled:cursor-wait disabled:opacity-60";

// Above the album's grid while there is a vote (M8 ticket 12): the award picker where there are
// two awards or more (ticket 13); whether voting is open or closed; for a viewer who may vote what
// a star does in the chosen award and whether theirs is in; and the refusal of a tile's star. For
// hosts (`eventId` is given to them alone), a box of their own with the chosen award's votes so far
// and Close voting, or Reopen voting once it is closed (ticket 10's actions); a press that does not
// go through says so there, and the page is drawn again as the site holds it (review fix, ticket 13).
// While voting, the time it closes by itself when the host set one (`closesAt`, written in the
// event's zone), and for a guest the host does not let vote, why (`notAmong`) in place of what a
// star does; for hosts, the way to tell guests voting is open (ticket 14). During an award's
// tie-break, its banner, with its round from round 3, what a star does in it and that its counts
// stay hidden, and for hosts Close the tie-break beside Reopen voting, which ends it; on the
// results, while first is shared, the hosts' offer of a tie-break, or of another round after one,
// or of keeping first place shared, and where a tie-break's items are all gone, a line saying so
// (review fix, ticket 15). On the results, the Winners strip heads the album, and the hosts may
// send the winners to guests with a message already written, while no award is in a tie-break
// (ticket 16).
export function AlbumVotingHead({
  awards,
  initial,
  mayVote,
  closesAt,
  notAmong,
  eventId,
}: {
  awards: HeadAward[];
  initial: string;
  mayVote: boolean;
  closesAt?: string;
  notAmong?: "onlyGoing" | "onlyInvited";
  eventId?: string;
}) {
  const t = useTranslations("Voting.album");
  const hosts = useTranslations("Voting.block");
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState<string>();
  const chosen = useChosen(awards, initial);
  const vote = useVote(chosen?.award ?? "", chosen?.voted ?? null, chosen?.drawn ?? "");
  const refused = useRefusal(chosen?.drawn ?? "");
  if (!chosen) return null;
  const tiebreak = chosen.stage === "tiebreak";
  const voting = chosen.stage === "voting" || tiebreak;
  const run = (action: (eventId: string) => Promise<{ error?: "albumNotOpen" | "refused" }>) =>
    startTransition(async () => {
      setFailed(undefined);
      let error: "albumNotOpen" | "refused" | "failed" | undefined;
      try {
        error = (await action(eventId!)).error;
      } catch {
        error = "failed";
      }
      if (error) setFailed(hosts(error === "albumNotOpen" ? "notYet" : "failed"));
      router.refresh();
    });
  // A host's button in the box, disabled while a press is on its way.
  const button = (label: string, action: (eventId: string) => Promise<{ error?: "albumNotOpen" | "refused" }>) => (
    <button type="button" disabled={busy} onClick={() => run(action)} className={HOSTS_BUTTON}>
      {label}
    </button>
  );
  // After a tie-break, the offer is of another round among the items still level.
  const held = chosen.round > 1;

  return (
    <div data-slot="album-voting" data-stage={chosen.stage} className="flex flex-col gap-2">
      {awards.length > 1 && <AwardPicker awards={awards} chosen={chosen} />}
      {voting ? (
        <>
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-theme-accent" aria-hidden />
            {tiebreak ? t("tiebreak.banner", { award: chosen.name }) : t("open")}
            {tiebreak && chosen.round >= 3 && (
              <>
                {" "}
                <span className="font-normal text-theme-text-muted">· {t("tiebreak.round", { round: chosen.round })}</span>
              </>
            )}
            {chosen.stage === "voting" && closesAt && (
              <>
                {" "}
                <span className="font-normal text-theme-text-muted">· {t("closesAt", { time: closesAt })}</span>
              </>
            )}
          </p>
          {mayVote ? (
            <>
              <p role="status" className="text-sm">
                {vote !== null ? t("yourVote", { award: chosen.name }) : tiebreak ? t("tiebreak.intro", { count: chosen.tied }) : t("tapToVote", { award: chosen.name })}
              </p>
              <p className="text-xs text-theme-text-faint">{t(tiebreak ? "tiebreak.hint" : "hint")}</p>
            </>
          ) : (
            notAmong && <p className="text-sm">{t(notAmong)}</p>
          )}
        </>
      ) : (
        <p className="text-sm font-medium">{t("closed")}</p>
      )}
      {chosen.stage === "results" && chosen.winners && <WinnersStrip award={chosen.name} winners={chosen.winners} />}
      {refused && (
        <p role="alert" className="text-sm font-medium">
          {t(`errors.${refused}`)}
        </p>
      )}
      {eventId && (
        <section data-slot="voting-hosts" aria-labelledby="voting-hosts-title" className="flex flex-col gap-2 rounded-xl border border-dashed border-theme-glass-border p-3">
          <h3 id="voting-hosts-title" className="text-xs font-medium tracking-label text-theme-text-muted uppercase">
            {t("hostsOnly")}
          </h3>
          {voting && chosen.total !== undefined && <p className="text-sm">{t("soFar", { count: chosen.total, award: chosen.name })}</p>}
          {chosen.finalistsGone && <p className="text-sm">{t("tiebreak.gone")}</p>}
          {chosen.offered && (
            <>
              <p className="text-sm">{t(held ? "tiebreak.stillLevel" : "tiebreak.shared", { count: chosen.tied, award: chosen.name })}</p>
              <div className="flex flex-wrap gap-2">
                {button(t(held ? "tiebreak.again" : "tiebreak.start"), (eventId) => startTiebreakAction(eventId, chosen.award))}
                {button(t("tiebreak.keep"), (eventId) => keepSharedFirstAction(eventId, chosen.award))}
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {tiebreak && button(t("tiebreak.close"), (eventId) => closeTiebreakAction(eventId, chosen.award))}
            {chosen.stage === "voting" ? button(hosts("close"), closeVotingAction) : button(hosts("reopen"), reopenVotingAction)}
          </div>
          {chosen.stage === "voting" && (
            <Link href={`/events/${eventId}/announcements?draft=voting`} className={HOSTS_LINK}>
              {hosts("announce")}
            </Link>
          )}
          {chosen.stage === "results" && awards.every((award) => award.stage !== "tiebreak") && (
            <Link href={`/events/${eventId}/announcements?draft=winners`} className={HOSTS_LINK}>
              {t("winners.send")}
            </Link>
          )}
          {failed && (
            <p role="alert" className="text-sm font-medium">
              {failed}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
