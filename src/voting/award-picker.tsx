"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { HeadAward } from "./album-voting-head";
import { useVote } from "./vote-star";
import { WHOLE_ALBUM } from "./voting";

// The award picker above the album (M8 ticket 13), drawn by the head when an event has two awards
// or more: one pill per award, the chosen one pressed, and a check where this viewer has a vote in
// it, as the stars show it. A press names the award in the page's query (`?award=`, M8 plan ruling
// 22) without a navigation, keeping the rest of the query, so the album, its stars and the head
// follow it and nothing else moves; a reload keeps it. An award for photos only or videos only
// says so under the pills, since the album then shows only those items.
//
// Where no award's list is the whole album (`whole`; the voting part's review, finding 2), the
// picker is drawn from one award, and a last pill, Whole album, shows every item with no star,
// count or ribbon (`chosen` is then none).
export function AwardPicker({ awards, chosen, whole }: { awards: HeadAward[]; chosen: HeadAward | undefined; whole: boolean }) {
  const t = useTranslations("Voting.album.picker");
  const choose = (award: string) => {
    const query = new URLSearchParams(window.location.search);
    query.set("award", award);
    window.history.replaceState(null, "", `${window.location.pathname}?${query}${window.location.hash}`);
  };
  return (
    <div className="flex flex-col gap-1.5" data-slot="award-picker">
      <div role="group" aria-label={t("label")} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        {awards.map((award) => (
          <Pill key={award.award} name={award.name} voted={award} pressed={award.award === chosen?.award} onPress={() => choose(award.award)} />
        ))}
        {whole && <Pill name={t("whole")} pressed={chosen === undefined} onPress={() => choose(WHOLE_ALBUM)} />}
      </div>
      {chosen && chosen.scope !== "all" && <p className="text-xs text-theme-text-muted">{t(chosen.scope === "photos" ? "forPhotos" : "forVideos")}</p>}
    </div>
  );
}

// A pill, with a check where `voted` names an award this viewer has a vote in.
function Pill({ name, voted, pressed, onPress }: { name: string; voted?: HeadAward; pressed: boolean; onPress: () => void }) {
  const t = useTranslations("Voting.album.picker");
  const hasVote = useVote(voted?.award ?? "", voted?.voted ?? null, voted?.drawn ?? "") !== null;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={hasVote ? t("voted", { award: name }) : undefined}
      onClick={onPress}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text",
        pressed ? "bg-theme-accent text-theme-on-accent" : "bg-theme-glass-strong hover:bg-theme-glass",
      )}
    >
      {hasVote && <Check className="size-4" aria-hidden />}
      {name}
    </button>
  );
}
