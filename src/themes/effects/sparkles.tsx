import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// A number from 0 to 1 for each whole number, always the same one: the points' places and paces
// come from their index alone, so the server and the browser draw the same sparkles and nothing
// moves when the page wakes up.
function scatter(n: number): number {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
}

const round = (value: number, places: number) => Number(value.toFixed(places));

// About two dozen points over the whole backdrop (PROTOTYPE.md, "Effect"), each twinkling at its
// own slow pace, from 2.4 to 5 seconds, starting part-way through so they never pulse together.
const POINTS = Array.from({ length: 26 }, (_, index) => {
  const [x, y, size] = [scatter(index * 3), scatter(index * 3 + 1), scatter(index * 3 + 2)];
  return { x: round(x * 100, 1), y: round(y * 100, 1), size: round(2 + size * 3, 1), duration: round(2.4 + size * 2.6, 2), delay: round(-y * 3, 2) };
});

// The Sparkles effect, in the backdrop: a third of the points in the accent, the rest white, each
// with a glow of its own colour. Under reduced motion none of it is drawn.
export function Sparkles() {
  return (
    <div data-effect="sparkles" className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {POINTS.map((point, index) => (
        <span
          key={index}
          className={cn("absolute rounded-full motion-safe:animate-theme-twinkle", index % 3 === 0 ? "bg-theme-accent text-theme-accent" : "bg-white text-white")}
          style={
            {
              left: `${point.x}%`,
              top: `${point.y}%`,
              width: point.size,
              height: point.size,
              boxShadow: `0 0 ${round(point.size * 3, 1)}px currentColor`,
              "--twinkle-duration": `${point.duration}s`,
              "--twinkle-delay": `${point.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
