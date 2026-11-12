"use client";

import { createContext, use, useOptimistic, useState, type CSSProperties, type ReactNode } from "react";
import { preload } from "react-dom";
import { cn } from "@/lib/utils";
import { applyChange, type ThemeChange } from "./changes";
import { Backdrop } from "./backdrop";
import { resolveTheme, themeVariables, type ResolvedTheme, type ThemeUpload } from "./resolve";
import type { Theme } from "./theme";
import { TITLE_FONT_CLASSES, TITLE_FONT_FILES } from "./title-fonts";

// The theme the page is wearing right now. For a guest that is the saved theme, always. For the
// host with a design sheet open it runs ahead of the save: `change` shows a change at once,
// inside the transition that saves it, and the page settles on the saved theme once it returns.
// `root` is the page's own element, where anything that rises over the page (the RSVP sheet) is
// put, so that it wears the theme too. `upload` is the event's upload, shown or not.
type ThemeState = {
  theme: Theme;
  resolved: ResolvedTheme;
  change: (change: ThemeChange) => void;
  root: HTMLElement | null;
  upload: ThemeUpload | null;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const state = use(ThemeContext);
  if (!state) throw new Error("useTheme outside a ThemedPage");
  return state;
}

// The root of a themed event page: carries the resolved theme as CSS variables and data
// attributes (see globals.css, "Event page theme"), the chosen title font, and the backdrop every
// layout shares. It renders on the server like any other, so the first paint is the finished
// look. The layout renders inside it; `designer` is the editor's chrome around it (top bar, toolbar, sheets).
export function ThemedPage({
  theme: saved,
  upload = null,
  designer,
  children,
}: {
  theme: Theme;
  upload?: ThemeUpload | null;
  designer?: ReactNode;
  children: ReactNode;
}) {
  const [theme, change] = useOptimistic(saved, applyChange);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const resolved = resolveTheme(theme, upload);
  // The title's face, asked for from the page's head, beside the stylesheet that names it, rather
  // than once the stylesheet has arrived and the title is laid out.
  preload(TITLE_FONT_FILES[resolved.font.key], { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <ThemeContext value={{ theme, resolved, change, root, upload }}>
      <div
        ref={setRoot}
        data-tone={resolved.textTone}
        data-layout={resolved.layout}
        // No background of its own: a positioned box would paint over the fixed backdrop below.
        // The Poster layout leaves room at its foot for the bar fixed there (pinned-bar.tsx).
        className={cn(
          "event-page relative min-h-dvh font-sans text-theme-text data-[layout=poster]:pb-28",
          TITLE_FONT_CLASSES[resolved.font.key],
        )}
        style={themeVariables(resolved) as CSSProperties}
      >
        <Backdrop theme={resolved} effect={theme.effect} />
        {children}
      </div>
      {designer}
    </ThemeContext>
  );
}
