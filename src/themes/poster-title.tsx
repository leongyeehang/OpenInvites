"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "./themed-page";

// Past this many characters a title takes the smaller size (see TitleFont.sizes).
const LONG_TITLE = 28;

// The event's title on the poster card, in the theme's font. It follows the theme as the host
// changes it, so it reads the font from the page rather than from the server.
export function PosterTitle({ title, className }: { title: string; className?: string }) {
  const { font } = useTheme().resolved;
  return (
    <h1 className={cn("font-title text-balance break-words drop-shadow-title", font.className, title.length > LONG_TITLE ? font.sizes.long : font.sizes.short, className)}>
      {title}
    </h1>
  );
}
