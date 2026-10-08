"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackgroundDescription } from "./background-description";
import { Glass } from "./glass";
import { PosterTitle } from "./poster-title";
import { posterTitleVariables, type ResolvedPoster } from "./resolve";
import { useTheme } from "./themed-page";

// The poster is as wide as the card, unless that would make it taller than the screen: then it
// is as tall as the screen allows, with room to see the page goes on, and narrower, so a guest
// sees all of it at once. It is never narrower than 20rem, where a title still fits on it.
export const fitted = ({ width, height }: ResolvedPoster): CSSProperties => ({ width: `min(100%, max(20rem, calc((100svh - 6rem) * ${width / height})))` });

// The invitation at the top of the Poster layout: a frosted card with the title large, the date
// and who is hosting. In poster mode the host's picture is the invitation itself, at its own
// proportions, with the title on its foot over a scrim or in a card below it. It follows the
// theme as the host changes it, so the server hands it its pieces and it arranges them.
export function PosterCard({
  title,
  eyebrow,
  sticker,
  host,
  className,
}: {
  title: string;
  eyebrow: ReactNode;
  sticker: ReactNode;
  host: ReactNode;
  className?: string;
}) {
  const { theme, resolved } = useTheme();
  const { poster } = resolved;
  const date = <StickerHolder tilted={theme.effect === "doodles"}>{sticker}</StickerHolder>;

  if (!poster) {
    return (
      <Glass data-slot="poster-card" className={cn("relative overflow-hidden rounded-4xl p-6 shadow-poster sm:p-8", className)}>
        <div className="absolute top-5 right-5 sm:top-7 sm:right-7">{date}</div>
        {eyebrow}
        <PosterTitle title={title} className="mt-12 sm:mt-14" />
        <div className="mt-6">{host}</div>
        <BackgroundDescription />
      </Glass>
    );
  }

  if (poster.titlePlacement === "on") {
    // The picture and the title's block share one cell, the block at its foot, as wide as the
    // picture whatever the title's longest word. A block taller than a wide, short poster makes
    // the card taller, on the base colour, rather than lose any of the title. Under the block
    // the poster is frosted and shaded as the glass is, at the strength that reads over anything
    // (legibility.ts, POSTER_SURFACES), fading out over its top padding so that it holds wherever
    // the title wraps. Who is hosting goes beneath, so the block covers as little as it can.
    return (
      <div data-slot="poster-card" className={className}>
        <div className="@container mx-auto grid grid-cols-1 overflow-hidden rounded-4xl bg-theme-base shadow-poster ring-1 ring-theme-glass-border" style={fitted(poster)}>
          <Picture poster={poster} className="col-start-1 row-start-1" />
          <div className="relative col-start-1 row-start-1 self-end px-6 pt-16 pb-6 sm:px-8 sm:pb-7" style={posterTitleVariables(resolved) as CSSProperties}>
            <div aria-hidden className="absolute inset-0 bg-theme-title-scrim backdrop-blur-xl [mask-image:linear-gradient(to_top,#000_calc(100%-4rem),transparent)]" />
            <div className="relative">
              {eyebrow}
              <PosterTitle title={title} compact className="mt-2" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <Glass strong className="rounded-full py-1.5 pr-4 pl-1.5">
            {host}
          </Glass>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="poster-card" className={cn("@container", className)}>
      <Picture poster={poster} className="mx-auto rounded-4xl shadow-poster ring-1 ring-theme-glass-border" style={fitted(poster)} />
      <Glass className="mt-3 rounded-4xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow}
            <PosterTitle title={title} compact className="mt-3" />
          </div>
          {date}
        </div>
        <div className="mt-6">{host}</div>
      </Glass>
    </div>
  );
}

// Holds the date sticker the layout drew. The Doodles effect tilts it about 6 degrees and fills it
// with the accent, as round one's B had it (PROTOTYPE.md, "Effect"): when motion is welcome it
// lands at its tilt with a small spring, once; under reduced motion it is simply there, tilted.
// On the accent its three lines take the accent's own text colour, as everything filled with the
// accent does (legibility.ts, onAccent), so the holder sets the glass and the text strengths the
// sticker draws with on itself.
function StickerHolder({ tilted, children }: { tilted: boolean; children: ReactNode }) {
  return (
    <div
      data-slot="date-sticker"
      className={cn("shrink-0", tilted && "-rotate-6 text-theme-on-accent motion-safe:animate-theme-sticker-in")}
      style={tilted ? ON_ACCENT : undefined}
    >
      {children}
    </div>
  );
}

const ON_ACCENT = {
  "--theme-glass-strong": "var(--theme-accent)",
  "--theme-glass-border": "var(--theme-accent)",
  "--theme-text-muted": "var(--theme-on-accent)",
  "--theme-text-faint": "var(--theme-on-accent)",
} as CSSProperties;

// The poster itself, at its own proportions: its size is known before it arrives, so the page
// keeps its place. It is the first thing a guest sees, and the largest, so it is fetched first.
// It was made on upload in the widths the card needs (uploads/renditions.ts), and the browser
// takes the one the card's width at its screen's density calls for: the card is the page's
// 36rem less its margins, or the screen less them. What the host says it shows is its
// alternative text, and without a description it is decoration. A layout that sets the poster
// at another width says so in `sizes`.
export function Picture({
  poster,
  sizes = "(min-width: 36rem) 34rem, calc(100vw - 2rem)",
  className,
  style,
}: {
  poster: ResolvedPoster;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // A plain <img>: next/image would add its optimiser's widths to pictures already made to size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster.src}
      srcSet={poster.srcSet}
      sizes={poster.srcSet && sizes}
      alt={poster.altText}
      width={poster.width}
      height={poster.height}
      fetchPriority="high"
      className={cn("block h-auto w-full", className)}
      style={style}
    />
  );
}
