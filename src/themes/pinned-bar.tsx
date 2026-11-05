"use client";

import type { CSSProperties, ReactNode } from "react";
import { sheetVariables } from "./resolve";
import { useTheme } from "./themed-page";

// The bar of the Poster layout, fixed to the foot of the screen, inside the safe area, and on a
// wider screen to the foot of the page's column: the reply buttons on an event page (rsvp-flow.tsx,
// poll-flow.tsx), the way in on the home page. It floats over whatever the page has under it
// there, so it is a surface of the sheet's kind, solved against anything (legibility.ts,
// SHEET_SURFACES). The page leaves room for it at its foot (themed-page.tsx). `slot` names it for
// the tests, as `data-slot` does elsewhere.
export function PinnedBar({ slot, children }: { slot: string; children: ReactNode }) {
  const { resolved } = useTheme();
  return (
    <div data-slot={slot} className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-40 mx-auto max-w-[26rem]" style={sheetVariables(resolved) as CSSProperties}>
      <div className="rounded-[1.6rem] border border-theme-glass-border bg-theme-sheet p-2 text-theme-text shadow-sheet backdrop-blur-2xl">{children}</div>
    </div>
  );
}
