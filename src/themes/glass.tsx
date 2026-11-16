import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// A frosted glass surface in the theme's tone: the poster card, the detail tiles, the notices.
// `strong` is the more opaque frost for small pieces that sit on other content. Its `data-slot` says
// a control on it sits on a proven surface (e2e/site-look.ts), unless a caller names it otherwise.
export function Glass({ strong = false, className, ...props }: ComponentProps<"div"> & { strong?: boolean }) {
  return (
    <div
      data-slot="glass"
      className={cn(
        "rounded-3xl border border-theme-glass-border shadow-glass backdrop-blur-xl",
        strong ? "bg-theme-glass-strong" : "bg-theme-glass",
        className,
      )}
      {...props}
    />
  );
}

// What a heading outside a panel sits on, set straight on the page (legibility.ts, SURFACES.page):
// the veil, often nothing at all, that keeps bare text readable on any backdrop. A control set
// beside a heading goes on one too, as its focus ring is solved against the veil and not the
// backdrop.
export function Veil({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="veil" className={cn("w-fit max-w-full rounded-2xl bg-theme-veil px-3 py-2 backdrop-blur-xl", className)} {...props} />;
}
