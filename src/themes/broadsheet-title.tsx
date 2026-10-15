"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { fitted, Picture } from "./poster-card";
import { posterTitleVariables } from "./resolve";
import { useTheme } from "./themed-page";

// The poster sits in the Broadsheet's text column, which is the page less its margins on a phone
// and about 34rem beside the ballot on a wide screen.
const SIZES = "(min-width: 64rem) 34rem, calc(100vw - 4rem)";

// The Broadsheet's one very large title (spec, "Broadsheet"), in the theme's font: the serif at
// its largest, the heavier faces a step smaller. In poster mode the host's picture leads, with the
// title on its foot over the scrim the Poster's title wears there (legibility.ts, POSTER_SURFACES),
// or set large below it. It follows the theme as the host changes it, so it reads it from the page.
export function BroadsheetTitle({ title }: { title: string }) {
  const { resolved } = useTheme();
  const { font, poster } = resolved;
  // The size comes before its line height: cn() drops a line height that a later size class
  // would set.
  const large = cn(
    "font-title text-balance break-words",
    font.className,
    font.key === "serif" ? "text-[clamp(3.5rem,14vw,8.5rem)]" : "text-[clamp(2.75rem,11vw,6.5rem)]",
    "leading-[0.92]",
  );

  if (!poster) return <h1 className={cn(large, "mt-8")}>{title}</h1>;

  if (poster.titlePlacement === "on") {
    return (
      <div className="@container mx-auto mt-8 grid grid-cols-1 overflow-hidden rounded-3xl bg-theme-base ring-1 ring-theme-glass-border" style={fitted(poster)}>
        <Picture poster={poster} sizes={SIZES} className="col-start-1 row-start-1" />
        <div className="relative col-start-1 row-start-1 self-end px-6 pt-16 pb-6" style={posterTitleVariables(resolved) as CSSProperties}>
          <div aria-hidden className="absolute inset-0 bg-theme-title-scrim backdrop-blur-xl [mask-image:linear-gradient(to_top,#000_calc(100%-4rem),transparent)]" />
          <h1 className={cn("relative font-title text-balance break-words drop-shadow-title", font.className, font.sizes.compact)}>{title}</h1>
        </div>
      </div>
    );
  }

  return (
    <>
      <Picture poster={poster} sizes={SIZES} className="mx-auto mt-8 rounded-3xl ring-1 ring-theme-glass-border" style={fitted(poster)} />
      <h1 className={cn(large, "mt-6")}>{title}</h1>
    </>
  );
}
