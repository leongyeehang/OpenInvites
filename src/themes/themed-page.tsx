"use client";

import { createContext, use, useOptimistic, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { applyChange, type ThemeChange } from "./changes";
import { resolveTheme, themeVariables, type ResolvedTheme, type SampledUpload } from "./resolve";
import type { Theme } from "./theme";
import { TITLE_FONT_CLASSES } from "./title-fonts";

// The theme the page is wearing right now. For a guest that is the saved theme, always. For the
// host with the Design drawer open it runs ahead of the save: `change` shows a change at once,
// inside the transition that saves it, and the page settles on the saved theme once it returns.
type ThemeState = { theme: Theme; resolved: ResolvedTheme; change: (change: ThemeChange) => void };

const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const state = use(ThemeContext);
  if (!state) throw new Error("useTheme outside a ThemedPage");
  return state;
}

// The root of a themed event page: carries the resolved theme as CSS variables and data
// attributes (see globals.css, "Event page theme"), the chosen title font, and the backdrop every
// layout shares. It renders on the server like any other, so the first paint is the finished
// look. The layout renders inside it; `designer` is the host's Design drawer, beside it.
export function ThemedPage({
  theme: saved,
  upload = null,
  designer,
  children,
}: {
  theme: Theme;
  upload?: SampledUpload | null;
  designer?: ReactNode;
  children: ReactNode;
}) {
  const [theme, change] = useOptimistic(saved, applyChange);
  const resolved = resolveTheme(theme, upload);
  return (
    <ThemeContext value={{ theme, resolved, change }}>
      <div
        data-tone={resolved.textTone}
        data-layout={resolved.layout}
        // No background of its own: a positioned box would paint over the fixed backdrop below.
        className={cn("event-page relative min-h-dvh font-sans text-theme-text", TITLE_FONT_CLASSES[resolved.font.key])}
        style={themeVariables(resolved) as CSSProperties}
      >
        <Backdrop theme={resolved} />
        {children}
      </div>
      {designer}
    </ThemeContext>
  );
}

// The warm layered background with grain: the gradient or scene, two soft blobs of colour that
// drift when motion is welcome, and a fade into the base colour at the foot of the page. The
// lightest and darkest points of each background are measured with all of this in place
// (backgrounds.ts), so change them together.
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
