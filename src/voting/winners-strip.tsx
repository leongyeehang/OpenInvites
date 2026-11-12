"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { RIBBON } from "./vote-star";
import type { Winner } from "./voting";

// A winner as the strip draws it: its place and first round's votes (voting.ts, winnersOf), its
// thumbnail's address, null while it has none to show, and its picture's text, "1st: Photo 2 by
// Priya Nair", with the name only where this viewer is shown it (album-voting.tsx, which leaves it
// out on the server).
export type StripWinner = Winner & { thumb: string | null; alt: string };

// The Winners strip (M8 ticket 16), at the head of the album once the chosen award's results are
// in: its first to third places, more on ties, each with its picture, its ribbon and its votes, in
// a row that scrolls sideways when it holds more than three (with no snapping, so nothing moves by
// itself), which the keyboard can then reach to scroll; or, where nobody voted in the award, says
// so. Not interactive: the grid's tiles open the viewer.
export function WinnersStrip({ award, winners }: { award: string; winners: StripWinner[] }) {
  const t = useTranslations("Voting.album");
  const id = useId();
  return (
    <section data-slot="winners-strip" aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-sm font-semibold">
        {t("winners.title", { award })}
      </h3>
      {winners.length === 0 ? (
        <p className="text-sm text-theme-text-muted">{t("winners.none", { award })}</p>
      ) : (
        <ul
          aria-labelledby={id}
          tabIndex={winners.length > 3 ? 0 : undefined}
          className="flex gap-2 overflow-x-auto rounded-xl pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text"
        >
          {winners.map((winner) => (
            // Three fit across the narrowest album; a fourth, on a tie, is scrolled to.
            <li key={winner.id} className="w-[calc((100%-1rem)/3)] max-w-32 shrink-0">
              <figure className="flex flex-col gap-1">
                <div className="relative">
                  {winner.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- served whole from the uploads route, already sized
                    <img src={winner.thumb} alt={winner.alt} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                  ) : (
                    <div role="img" aria-label={winner.alt} className="aspect-square w-full rounded-xl bg-theme-glass-strong" />
                  )}
                  {/* The picture's text names the place; the ribbon shows it. */}
                  <span
                    aria-hidden
                    data-slot="winner-ribbon"
                    className={cn("absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-on-ribbon", RIBBON[winner.place])}
                  >
                    {t("place", { place: winner.place })}
                  </span>
                </div>
                <figcaption className="text-xs text-theme-text-muted tabular-nums">{t("votes", { count: winner.votes })}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
