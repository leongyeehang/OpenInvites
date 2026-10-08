import type { ComponentProps, ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The Thread layout's bubbles (spec, "Thread"), which the layout's own host bubbles and the
// conversation under them share. A host bubble is strong glass over the backdrop
// (legibility.ts, SURFACES.strongGlass), so its text reads at every strength, and anything in it
// that wants the accent is filled with it. A chip in a host bubble is only a ring, so its label
// sits on the bubble's own glass. The guest's own bubbles are filled with the accent, their words
// in the accent's own text colour.

export const HOST_BUBBLE =
  "w-fit max-w-[85%] self-start rounded-[22px] rounded-bl-md border border-theme-glass-border bg-theme-glass-strong px-4 py-3 text-[15px] leading-snug break-words shadow-glass backdrop-blur-xl";

export function HostBubble({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(HOST_BUBBLE, className)} {...props} />;
}

export function GuestBubble({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-fit max-w-[78%] self-end rounded-[22px] rounded-br-md bg-theme-accent px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap text-theme-on-accent shadow-glass",
        className,
      )}
      {...props}
    />
  );
}

// An action in a host bubble: the map, the edit link, the calendar.
export const BUBBLE_CHIP =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-current/30 px-3.5 text-sm font-medium hover:border-current/60";

// A host bubble's small heading: When, Where, Who's coming.
export function BubbleLabel({ icon: Icon, children }: { icon?: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-label text-theme-text-faint uppercase">
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </h2>
  );
}

// A bubble comes into the conversation from below when motion is welcome; under reduced motion
// none of this applies and it is simply there.
const RISE = "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-300 motion-safe:ease-out";
export const ARRIVAL = cn(RISE, "motion-safe:fade-in");

const STAGGER = ["motion-safe:delay-0", "motion-safe:delay-90", "motion-safe:delay-180", "motion-safe:delay-270", "motion-safe:delay-360", "motion-safe:delay-450"];

// What the page holds when it opens arrives at once: the host's first six bubbles one after
// another, 90 ms apart, and the rest with the sixth (by default). The first, the invitation, fades
// in from a trace rather than from nothing, so the browser counts it as the page's largest paint
// at once (poster-layout.tsx says why).
export function arriving(index = STAGGER.length - 1): string {
  return cn(RISE, index === 0 ? "motion-safe:fade-in-1" : "motion-safe:fade-in", STAGGER[Math.min(index, STAGGER.length - 1)]);
}
