import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// How long one float takes, and how far up it goes.
const float = (seconds: number, rise: number) => ({ "--float-duration": `${seconds}s`, "--float-rise": `-${rise}px` }) as CSSProperties;
const floats = "absolute motion-safe:animate-theme-float";

// The Doodles effect, in the backdrop (PROTOTYPE.md, "Effect"; round one's B): seven shapes in the
// accent at low opacity, rings, dots, a tile, a stroke and a squiggle, near the screen's edges,
// each floating up and back at its own slow pace. On the Poster layout the date sticker tilts too
// (poster-card.tsx). Under reduced motion none of the shapes are drawn.
export function Doodles() {
  return (
    <div data-effect="doodles" className="pointer-events-none absolute inset-0 text-theme-accent motion-reduce:hidden">
      <span className={cn(floats, "top-[18%] -left-4 size-16 rounded-full border-6 border-current opacity-35")} style={float(7, 10)} />
      <span className={cn(floats, "top-[30%] -right-2 size-10 rounded-full border-4 border-current opacity-30")} style={float(12, 10)} />
      <span className={cn(floats, "top-[6%] right-1/3 size-3 rounded-full bg-current opacity-50")} style={float(11, 9)} />
      <span className={cn(floats, "bottom-[30%] left-[10%] size-4 rounded-full bg-current opacity-40")} style={float(9.5, 11)} />
      <span className={cn(floats, "right-[12%] bottom-[22%] size-6 rotate-12 rounded-md bg-current opacity-40")} style={float(9, 14)} />
      <span className={cn(floats, "bottom-[6%] left-[38%] h-3 w-24 -rotate-6 rounded-full bg-current opacity-30")} style={float(8, 8)} />
      <svg className={cn(floats, "top-[58%] right-[6%] size-14 opacity-45")} style={float(10, 12)} viewBox="0 0 48 48" fill="none">
        <path d="M4 30c8-14 14 14 22 0s12-14 18 0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
