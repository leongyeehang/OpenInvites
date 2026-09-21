import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { themeVariables, type ResolvedTheme } from "./resolve";
import { TITLE_FONT_CLASSES } from "./title-fonts";

// The root of a themed event page: carries the resolved theme as CSS variables and data
// attributes (see globals.css, "Event page theme"), the chosen title font, and the backdrop every
// layout shares. The layout renders inside it.
export function ThemedPage({ theme, children }: { theme: ResolvedTheme; children: ReactNode }) {
  return (
    <div
      data-tone={theme.textTone}
      data-layout={theme.layout}
      // No background of its own: a positioned box would paint over the fixed backdrop below.
      className={cn("event-page relative min-h-dvh font-sans text-theme-text", TITLE_FONT_CLASSES[theme.font.key])}
      style={themeVariables(theme) as CSSProperties}
    >
      <Backdrop theme={theme} />
      {children}
    </div>
  );
}

// The warm layered background with grain: the gradient or scene, two soft blobs of colour that
// drift when motion is welcome, and a fade into the base colour at the foot of the page.
function Backdrop({ theme }: { theme: ResolvedTheme }) {
  const { background } = theme;
  return (
    <div aria-hidden className="grain fixed inset-0 -z-10 overflow-hidden bg-theme-base">
      {background.kind === "gradient" ? (
        <>
          <div className="absolute inset-0" style={{ background: background.css }} />
          <div className="absolute top-[28%] -left-1/4 size-[70vmin] rounded-full bg-theme-accent opacity-25 blur-3xl motion-safe:animate-theme-drift" />
          {/* The second blob starts halfway through the same drift, so the two never move in step. */}
          <div className="absolute top-[45%] -right-1/3 size-[80vmin] rounded-full bg-theme-glow/25 blur-3xl motion-safe:animate-theme-drift motion-safe:delay-[-12s]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${background.src})` }} />
          {/* Scenes get a scrim so the text tone always reads. */}
          <div className="absolute inset-0 bg-theme-scrim" />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-theme-base to-transparent" />
    </div>
  );
}
