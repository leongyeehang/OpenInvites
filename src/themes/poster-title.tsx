"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "./themed-page";
import { fittedTitleSize } from "./title-fit";

// Past this many characters a title takes the smaller size (see TitleFont.sizes).
const LONG_TITLE = 28;

// The event's title on the poster card, in the theme's font. It follows the theme as the host
// changes it, so it reads the font from the page rather than from the server. Beside the host's
// poster it is `compact`: smaller whatever its length, so the poster leads, and sized to the
// poster card (a container) rather than the screen. Given `fitTo`, the width it has (a CSS length
// in the poster card's container units), it steps down from that size until its widest word fits
// (title-fit.ts): the home page's title, the instance's name, is often one long word. The fitted
// size is set on a line of its own inside the heading, where 1em is the size the class gives.
export function PosterTitle({ title, compact = false, fitTo, className }: { title: string; compact?: boolean; fitTo?: string; className?: string }) {
  const { font } = useTheme().resolved;
  return (
    <h1 className={cn("font-title text-balance break-words drop-shadow-title", font.className, compact ? font.sizes.compact : title.length > LONG_TITLE ? font.sizes.long : font.sizes.short, className)}>
      {fitTo ? (
        <span className="block" style={{ fontSize: fittedTitleSize(title, font.key, fitTo) }}>
          {title}
        </span>
      ) : (
        title
      )}
    </h1>
  );
}
