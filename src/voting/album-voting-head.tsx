"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { closeVotingAction, reopenVotingAction } from "./host-actions";
import { useChosen, useRefusal, useVote } from "./vote-star";
import type { AwardStage } from "./voting";

// One award as the head shows it: its name as displayed, where it stands, this viewer's vote in it
// (the item voted for, or none), and for hosts the votes given so far.
export type HeadAward = { award: string; name: string; stage: AwardStage; voted: string | null; total?: number };

// Above the album's grid while there is a vote (M8 ticket 12): whether voting is open or closed,
// for a viewer who may vote what a star does and whether theirs is in, and the refusal of a tile's
// star. For hosts (`eventId` is given to them alone), a box of their own with the votes so far and
// Close voting, or Reopen voting once it is closed (ticket 10's actions).
export function AlbumVotingHead({ awards, initial, mayVote, eventId }: { awards: HeadAward[]; initial: string; mayVote: boolean; eventId?: string }) {
  const t = useTranslations("Voting.album");
  const hosts = useTranslations("Voting.block");
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const chosen = useChosen(awards, initial);
  const vote = useVote(chosen?.award ?? "", chosen?.voted ?? null);
  const refused = useRefusal();
  if (!chosen) return null;
  const voting = chosen.stage === "voting" || chosen.stage === "tiebreak";
  const run = (action: (eventId: string) => Promise<void>) =>
    startTransition(async () => {
      await action(eventId!);
      router.refresh();
    });

  return (
    <div data-slot="album-voting" data-stage={chosen.stage} className="flex flex-col gap-2">
      {voting ? (
        <>
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-theme-accent" aria-hidden />
            {t("open")}
          </p>
          {mayVote && (
            <>
              <p role="status" className="text-sm">
                {t(vote === null ? "tapToVote" : "yourVote", { award: chosen.name })}
              </p>
              <p className="text-xs text-theme-text-faint">{t("hint")}</p>
            </>
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
        </section>
      )}
    </div>
  );
}
