"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PosterTitle } from "./poster-title";
import { posterTitleVariables, type ResolvedPoster } from "./resolve";
import { useTheme } from "./themed-page";

// Beside the Broadsheet's title and in the Thread's bubble, the poster is as wide as its place,
// unless that would make it taller than the screen: then it is as tall as the screen allows, with
// room to see the page goes on, and narrower, so a guest sees all of it at once. It is never
// narrower than 20rem, where a title still fits on it.
export const fitted = ({ width, height }: ResolvedPoster): CSSProperties => ({ width: `min(100%, max(20rem, calc((100svh - 6rem) * ${width / height})))` });

// The top of the Poster layout (M4 spec, "The guest page"): the poster first, as wide as the
// page's column, and the title with its date on it or below it. A picture, the host's or the
// gallery's, is shown at its own proportions; one too tall for the screen is narrowed so the page
// shows it whole. With the title below it, it fades into the blurred copy behind the page, and the
// title rises a little into the faded foot, where almost nothing of the picture is left to read
// against. With the title on it, the title and date sit on a frosted shade at its foot that reads
// over anything (legibility.ts, POSTER_SURFACES). A colour is a block of its gradient, 4:5, with
// the title on it the same way. It follows the theme as the host changes it, so the server hands
// it its pieces and it arranges them.
export function PosterHero({ title, when, className }: { title: string; when: ReactNode; className?: string }) {
  const { resolved } = useTheme();
  const { poster, background } = resolved;

  if (!poster || poster.titlePlacement === "on") {
    return (
      <div data-slot="poster-card" className={cn("@container", className)}>
        <div
          className="mx-auto grid grid-cols-1 bg-theme-base md:mt-6 md:overflow-hidden md:rounded-4xl md:shadow-poster md:ring-1 md:ring-theme-glass-border"
          style={poster ? heroWidth(poster) : undefined}
        >
          {poster ? (
            <Picture poster={poster} sizes={HERO_SIZES} className="col-start-1 row-start-1" />
          ) : (
            // A colour poster: its gradient, which the page behind it wears too.
            <div aria-hidden className="col-start-1 row-start-1 aspect-[4/5] max-h-[70svh] w-full" style={{ background: background.kind === "gradient" ? background.css : undefined }} />
          )}
          <div className="relative col-start-1 row-start-1 self-end px-5 pt-20 pb-5 sm:px-6" style={posterTitleVariables(resolved) as CSSProperties}>
            <div aria-hidden className="absolute inset-0 bg-theme-title-scrim backdrop-blur-xl [mask-image:linear-gradient(to_top,#000_calc(100%-5rem),transparent)]" />
            <div className="relative">
              <PosterTitle title={title} compact />
              <p className="mt-2 text-sm font-medium text-theme-text-muted">{when}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-slot="poster-card" className={cn("@container", className)}>
      <div className="mx-auto md:mt-6 md:overflow-hidden md:rounded-t-4xl" style={heroWidth(poster)}>
        <Picture poster={poster} sizes={HERO_SIZES} className="[mask-image:linear-gradient(#000_70%,transparent)]" />
      </div>
      <div className="relative -mt-8 px-5 sm:px-6">
        <PosterTitle title={title} />
        <p className="mt-2 text-sm font-medium text-theme-text-muted">{when}</p>
      </div>
    </div>
  );
}

// The poster spans the page's column (28rem at most), edge to edge on a phone.
const HERO_SIZES = "(min-width: 28rem) 28rem, 100vw";

// As wide as the column, unless that would make it taller than most of the screen: then narrower,
// so a guest sees all of it at once. Never narrower than 20rem, where a title still fits on it.
const heroWidth = ({ width, height }: ResolvedPoster): CSSProperties => ({ width: `min(100%, max(20rem, calc(85svh * ${width / height})))` });

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
