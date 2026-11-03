"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackgroundDescription } from "./background-description";
import { Picture } from "./poster-card";
import { PosterTitle } from "./poster-title";
import { posterTitleVariables } from "./resolve";
import { useTheme } from "./themed-page";
import { HOST_BUBBLE } from "./thread-bubble";

// The poster as the Thread's bubble sets it: as wide as the bubble, which is most of the column.
const SIZES = "(min-width: 28rem) 22rem, 80vw";

// The Thread's first host bubble: the invitation itself, as a card (spec, "Thread"). The page's
// background with "You're invited", the title and the date at its foot; in poster mode, the host's
// poster with the title on its foot or below it. Whatever is under the title is not known (a
// scene, a gradient, the host's picture), so the title sits on the scrim the Poster sets a title
// on a poster with (legibility.ts, POSTER_SURFACES), which reads over anything. Below a poster
// it sits on the bubble's glass. It follows the theme as the host changes it.
export function ThreadCard({ title, invited, when, className }: { title: string; invited: string; when: string; className?: string }) {
  const { resolved } = useTheme();
  const { poster, background } = resolved;
  const eyebrow = <p className="text-[11px] font-medium tracking-label text-theme-text-muted uppercase">{invited}</p>;
  const date = <p className="mt-2 text-sm text-theme-text-muted">{when}</p>;
  const frame = cn(HOST_BUBBLE, "@container w-[85%] overflow-hidden p-0", className);

  if (poster?.titlePlacement === "below") {
    return (
      <div data-slot="thread-card" className={frame}>
        <Picture poster={poster} sizes={SIZES} />
        <div className="px-4 pt-3 pb-4">
          {eyebrow}
          <PosterTitle title={title} compact className="mt-1.5" />
          {date}
        </div>
      </div>
    );
  }

  const picture = poster ? (
    <Picture poster={poster} sizes={SIZES} className="col-start-1 row-start-1" />
  ) : (
    <div
      aria-hidden
      className="col-start-1 row-start-1 aspect-[4/3] bg-cover bg-center"
      style={background.kind === "gradient" ? { background: background.css } : { backgroundImage: `url(${background.src})` }}
    />
  );
  return (
    <div data-slot="thread-card" className={frame}>
      <div className="grid grid-cols-1">
        {picture}
        <OnScrim>
          {eyebrow}
          <PosterTitle title={title} compact className="mt-1.5" />
          {!poster && date}
        </OnScrim>
        {!poster && <BackgroundDescription />}
      </div>
      {poster && <div className="px-4 pb-4">{date}</div>}
    </div>
  );
}

// At the foot of the picture, over the title's scrim, frosted as the glass is, fading out above.
function OnScrim({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  return (
    <div className="relative col-start-1 row-start-1 self-end px-4 pt-12 pb-4" style={posterTitleVariables(resolved) as CSSProperties}>
      <div aria-hidden className="absolute inset-0 bg-theme-title-scrim backdrop-blur-xl [mask-image:linear-gradient(to_top,#000_calc(100%-3rem),transparent)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
