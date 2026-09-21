import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// A frosted glass surface in the theme's tone: the poster card, the detail tiles, the notices.
// `strong` is the more opaque frost for small pieces that sit on other content.
export function Glass({ strong = false, className, ...props }: ComponentProps<"div"> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-theme-glass-border shadow-glass backdrop-blur-xl",
        strong ? "bg-theme-glass-strong" : "bg-theme-glass",
        className,
      )}
      {...props}
    />
  );
}
