import { cn } from "@/lib/utils";
import { Doodles } from "./effects/doodles";
import { Sparkles } from "./effects/sparkles";
import type { ResolvedTheme } from "./resolve";
import type { Effect } from "./theme";

// The warm layered background with grain: a colour poster's gradient with two soft blobs of colour
// that drift when motion is welcome, and a fade into the base colour at the foot of the page.
// Behind a picture poster, the host's or the gallery's, its small copy is blurred to a wash of its
// own colours, far enough past the screen's edges that they stay full, under a stronger scrim.
// The lightest and darkest points of each background are measured with all of this in place
// (backgrounds.ts for the colours, uploads/process.ts for an upload and its copy, and
// scripts/posters/build.ts, which measures a gallery poster as process.ts does), so change them
// together.
//
// The theme's effect, sparkles or doodles, is drawn here too, over the rest of the backdrop and so
// under everything every layout puts on it (confetti alone falls over the page, from the RSVP
// flow). Where there is text, the glass is between it and the effect: effects never sit over
// text, so legibility.ts, which solves the glass against the backdrop, needs no change for them.
// Under reduced motion neither is drawn.
//
// `still` is the backdrop of every page that is not an event page (site-page.tsx; M8 spec,
// "Glass", "Still"): the same at rest, but its blobs never drift and it draws no effect.
export function Backdrop({ theme, effect, still = false }: { theme: ResolvedTheme; effect: Effect; still?: boolean }) {
  const { background } = theme;
  return (
    <div aria-hidden data-slot="backdrop" className="grain fixed inset-0 -z-10 overflow-hidden bg-theme-base">
      {background.kind === "photo" ? (
        <>
          <div className="absolute -inset-32 bg-cover bg-center blur-3xl" style={{ backgroundImage: `url(${background.src})` }} />
          <div className="absolute inset-0 bg-theme-scrim" />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: background.css }} />
          <div className={cn("absolute top-[28%] -left-1/4 size-[70vmin] rounded-full bg-theme-accent opacity-25 blur-3xl", !still && "motion-safe:animate-theme-drift")} />
          {/* The second blob starts halfway through the same drift, so the two never move in step. */}
          <div
            className={cn(
              "absolute top-[45%] -right-1/3 size-[80vmin] rounded-full bg-theme-glow/25 blur-3xl",
              !still && "motion-safe:animate-theme-drift motion-safe:delay-[-12s]",
            )}
          />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-theme-base to-transparent" />
      {!still && effect === "sparkles" && <Sparkles />}
      {!still && effect === "doodles" && <Doodles />}
    </div>
  );
}
