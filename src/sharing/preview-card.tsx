import type { ReactElement } from "react";
import type { EventWithHost } from "@/events/repository";
import { TONE_BASE, TONE_TEXT, type ResolvedTheme } from "@/themes/resolve";

// The card a chat app shows when someone pastes the link, at the size every platform expects.
export const PREVIEW_SIZE = { width: 1200, height: 630 };

// Painted without a stylesheet, so it reads the theme's resolved colours directly. A curated
// gradient is used as it is written; a photographic background is not fetched here, so its
// accent and tone stand in for it.
function backdrop(theme: ResolvedTheme): string {
  const base = TONE_BASE[theme.textTone];
  return theme.background.kind === "gradient" ? theme.background.css : `linear-gradient(150deg, ${theme.accent} 0%, ${base} 70%)`;
}

export function previewCard(event: EventWithHost, theme: ResolvedTheme, when: string): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 80,
        color: TONE_TEXT[theme.textTone],
        background: backdrop(theme),
      }}
    >
      <div style={{ display: "flex", fontSize: 30, opacity: 0.75, letterSpacing: 6, textTransform: "uppercase" }}>
        {event.hostName}
      </div>
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700, lineHeight: 1.05, marginTop: 16 }}>{event.title}</div>
      <div style={{ display: "flex", fontSize: 36, opacity: 0.85, marginTop: 24 }}>{when}</div>
    </div>
  );
}
