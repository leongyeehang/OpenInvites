"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "./themed-page";

// Past this many characters a title takes the smaller size (see TitleFont.sizes).
const LONG_TITLE = 28;

// The event's title on the poster card, in the theme's font. It follows the theme as the host
// changes it, so it reads the font from the page rather than from the server. Beside the host's
// poster it is `compact`: smaller whatever its length, so the poster leads, and sized to the
// poster card (a container) rather than the screen.
export function PosterTitle({ title, compact = false, className }: { title: string; compact?: boolean; className?: string }) {
  const { font } = useTheme().resolved;
  return (
    <h1 className={cn("font-title text-balance break-words drop-shadow-title", font.className, compact ? font.sizes.compact : title.length > LONG_TITLE ? font.sizes.long : font.sizes.short, className)}>
      {title}
    </h1>
  );
}
