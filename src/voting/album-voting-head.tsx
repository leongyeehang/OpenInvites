"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AwardPicker } from "./award-picker";
import { closeVotingAction, reopenVotingAction } from "./host-actions";
import { useChosen, useRefusal, useVote } from "./vote-star";
import type { AwardScope, AwardStage } from "./voting";

// One award as the head shows it: its name as displayed, what it is for, where it stands, this
// viewer's vote in it (the item voted for, or none), the page's drawing (vote-star.tsx, ItemAward),
// and for hosts the votes given so far.
export type HeadAward = { award: string; name: string; scope: AwardScope; stage: AwardStage; voted: string | null; drawn: string; total?: number };

// Above the album's grid while there is a vote (M8 ticket 12): the award picker where there are
// two awards or more (ticket 13); whether voting is open or closed; for a viewer who may vote what
// a star does in the chosen award and whether theirs is in; and the refusal of a tile's star. For
// hosts (`eventId` is given to them alone), a box of their own with the chosen award's votes so far
// and Close voting, or Reopen voting once it is closed (ticket 10's actions); a press that does not
// go through says so there, and the page is drawn again as the site holds it (review fix, ticket 13).
// While voting, the time it closes by itself when the host set one (`closesAt`, written in the
// event's zone), and for a guest the host does not let vote, why (`notAmong`) in place of what a
// star does; for hosts, the way to tell guests voting is open (ticket 14).
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
  const voting = chosen.stage === "voting" || chosen.stage === "tiebreak";
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

  return (
    <div data-slot="album-voting" data-stage={chosen.stage} className="flex flex-col gap-2">
      {awards.length > 1 && <AwardPicker awards={awards} chosen={chosen} />}
      {voting ? (
        <>
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-theme-accent" aria-hidden />
            {t("open")}
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
                {t(vote === null ? "tapToVote" : "yourVote", { award: chosen.name })}
              </p>
              <p className="text-xs text-theme-text-faint">{t("hint")}</p>
            </>
          ) : (
            notAmong && <p className="text-sm">{t(notAmong)}</p>
          )}
        </>
      ) : (
        <p className="text-sm font-medium">{t("closed")}</p>
      )}
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
          <button
            type="button"
            disabled={busy}
            onClick={() => run(voting ? closeVotingAction : reopenVotingAction)}
            className="inline-flex h-9 cursor-pointer items-center self-start rounded-full bg-theme-glass-strong px-4 text-sm font-medium hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text disabled:cursor-wait disabled:opacity-60"
          >
            {hosts(voting ? "close" : "reopen")}
          </button>
          {chosen.stage === "voting" && (
            <Link href={`/events/${eventId}/announcements?draft=voting`} className="self-start text-sm underline underline-offset-4 hover:opacity-80">
              {hosts("announce")}
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
