"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setVoteAction } from "./actions";
import { voteShown, type ItemStanding, type PendingVote } from "./voting";

// Why a vote was refused (actions.ts, setVoteAction), or that it never reached the site (a dropped
// connection, a failure there).
export type VoteRefusal = "tooFast" | "closed" | "notAllowed" | "failed";

// One item's standing in one award, as its star and badges draw it: the award, this viewer's vote
// in it (the item voted for, or none), the drawing of the page it comes from (a token each drawing
// has of its own), and the item's own standing (voting.ts, ItemStanding).
export type ItemAward = ItemStanding & { award: string; voted: string | null; drawn: string };

// The viewer's presses in each award, shared by every star of the album and the head (M8 ticket
// 12): a press moves the vote at once, un-pressing the old star, before the page comes back with
// it. What shows is voteShown's (voting.ts): the choice while a press is on its way and, after,
// while the page is still the drawing it was shown over; once a new drawing arrives, the page's
// own word, so a vote taken away without a press (its item deleted, voting turned off and on) is
// never shown. An entry a new drawing has overtaken is ignored, and replaced at the next press.
// Written only in event handlers; on the server, and in the first drawing, the page's vote alone.
// The refusal of a tile's star is kept, with its drawing, for the head's alert.
const pending = new Map<string, PendingVote>();
let lastRefusal: { refusal: VoteRefusal; drawn: string } | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const changed = () => listeners.forEach((listener) => listener());

// The item this viewer's vote in `award` is for, as shown now: `voted` is the page's, `drawn` the
// page's drawing.
export function useVote(award: string, voted: string | null, drawn: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => voteShown(pending.get(award), voted, drawn),
    () => voted,
  );
}

// The refusal of the last press of a tile's star, for the head's alert, while the page is the
// drawing it was refused on.
export function useRefusal(drawn: string): VoteRefusal | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (lastRefusal?.drawn === drawn ? lastRefusal.refusal : undefined),
    () => undefined,
  );
}

// The award the album shows (`?award=`, M8 plan ruling 22): the one the page's query names among
// those given, or the first.
export function useChosen<T extends { award: string }>(awards: T[], initial: string): T | undefined {
  const named = useSearchParams().get("award");
  return awards.find((each) => each.award === named) ?? awards.find((each) => each.award === initial);
}

// A press of a star: the vote moved to this item, or taken back when it is already this item's.
// The action runs in a transition, and the page it redraws confirms the vote. Once the answer is
// in, the choice is held over the drawing then shown, so a page that came back between two quick
// presses does not flash the first; a refusal, or an answer that never came, forgets the choice.
// `refused` is told of the refusal with the drawing it happened on, or of none at each press.
function usePress(slug: string, drawn: string, refused: (refusal: { refusal: VoteRefusal; drawn: string } | undefined) => void) {
  const [, startTransition] = useTransition();
  // The drawing shown now, read when an answer comes in.
  const shownDrawing = useRef(drawn);
  useEffect(() => {
    shownDrawing.current = drawn;
  }, [drawn]);
  return (vote: ItemAward, item: string, shown: string | null) => {
    const choice = shown === item ? null : item;
    const sending = pending.get(vote.award)?.sending ?? 0;
    pending.set(vote.award, { choice, drawn: vote.drawn, sending: sending + 1 });
    lastRefusal = undefined;
    refused(undefined);
    changed();
    startTransition(async () => {
      let refusal: VoteRefusal | undefined;
      try {
        refusal = (await setVoteAction(slug, vote.award, choice)).error;
      } catch {
        refusal = "failed";
      } finally {
        const now = pending.get(vote.award);
        if (now) {
          now.sending = Math.max(0, now.sending - 1);
          now.drawn = shownDrawing.current;
        }
        if (refusal) {
          pending.delete(vote.award);
          refused({ refusal, drawn: shownDrawing.current });
        }
        changed();
      }
    });
  };
}

const BADGE = "pointer-events-none absolute inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums";
const RIBBON = { 1: "bg-ribbon-first", 2: "bg-ribbon-second", 3: "bg-ribbon-third" } as const;

// On a tile of the album, beside its thumbnail button (never inside it): the star at the bottom
// right where this viewer may vote for the item, named by the thumbnail's label ("Vote for Photo
// 2", without a video's length or the Live mark), since the album numbers its items only once an
// award is chosen; its count at the top right where
// this viewer is shown it; its ribbon at the top left once the results are in. The badges take no
// pointer events, so a press on them opens the item.
export function ItemVote({ slug, item, initial, awards }: { slug: string; item: string; initial: string; awards: ItemAward[] }) {
  const t = useTranslations("Voting.album");
  const id = useId();
  const vote = useChosen(awards, initial);
  const drawn = vote?.drawn ?? "";
  const shown = useVote(vote?.award ?? "", vote?.voted ?? null, drawn);
  const press = usePress(slug, drawn, (refused) => {
    lastRefusal = refused;
  });
  if (!vote) return null;
  const mine = shown === item;
  return (
    <>
      {vote.place && (
        <span role="img" aria-label={t("placeLabel", { place: vote.place })} data-slot="vote-ribbon" className={cn(BADGE, "top-1 left-1 text-on-ribbon", RIBBON[vote.place])}>
          <span aria-hidden>{t("place", { place: vote.place })}</span>
        </span>
      )}
      {vote.shownVotes !== undefined && (
        <span role="img" aria-label={t("votes", { count: vote.shownVotes })} data-slot="vote-count" className={cn(BADGE, "top-1 right-1 bg-black/55 text-white")}>
          <Star className="size-3 fill-current" aria-hidden />
          <span aria-hidden>{vote.shownVotes}</span>
        </span>
      )}
      {vote.may && (
        <>
          <span id={id} hidden>
            {t("voteFor")}
          </span>
          <button
            type="button"
            data-slot="vote-star"
            aria-pressed={mine}
            aria-labelledby={`${id} album-item-${item}-label`}
            onClick={() => press(vote, item, shown)}
            className={cn(
              "absolute right-1 bottom-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text",
              mine ? "bg-theme-accent text-theme-on-accent" : "bg-black/55 text-white hover:bg-black/70",
            )}
          >
            <Star className={cn("size-5", mine && "fill-current")} aria-hidden />
          </button>
        </>
      )}
    </>
  );
}

// In the viewer's header, before Download: the same star as a labelled button, and the count and
// the place as text. A refusal shows under the star.
export function ViewerVote({ slug, item, kind, initial, awards }: { slug: string; item: string; kind: "photo" | "video"; initial: string; awards: ItemAward[] }) {
  const t = useTranslations("Voting.album");
  const vote = useChosen(awards, initial);
  const drawn = vote?.drawn ?? "";
  const shown = useVote(vote?.award ?? "", vote?.voted ?? null, drawn);
  // Shown while the page is the drawing it was refused on.
  const [refused, setRefused] = useState<{ refusal: VoteRefusal; drawn: string }>();
  const press = usePress(slug, drawn, setRefused);
  if (!vote || (!vote.may && vote.shownVotes === undefined && !vote.place)) return null;
  const mine = shown === item;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-2 text-sm">
        {vote.place && (
          <span data-slot="vote-ribbon" className={cn("rounded-full px-2 py-0.5 text-xs font-semibold text-on-ribbon", RIBBON[vote.place])}>
            {t("placeLabel", { place: vote.place })}
          </span>
        )}
        {vote.shownVotes !== undefined && (
          <span data-slot="vote-count" className="tabular-nums text-white/80">
            {t("votes", { count: vote.shownVotes })}
          </span>
        )}
        {vote.may && (
          <button
            type="button"
            data-slot="vote-star"
            aria-pressed={mine}
            aria-label={t("voteThis", { kind })}
            onClick={() => press(vote, item, shown)}
            className={cn(
              "inline-flex size-10 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white",
              // The viewer is drawn over the page, outside the theme's element, in white on black.
              mine ? "bg-white text-black" : "hover:bg-white/10",
            )}
          >
            <Star className={cn("size-5", mine && "fill-current")} aria-hidden />
          </button>
        )}
      </div>
      {refused?.drawn === drawn && (
        <p role="alert" className="text-xs font-medium">
          {t(`errors.${refused.refusal}`)}
        </p>
      )}
    </div>
  );
}
