import type { ReactElement } from "react";
import type { EventWithHost } from "@/events/repository";
import { hexToRgb } from "@/themes/legibility";
import { TONE_BASE, TONE_TEXT, type ResolvedTheme } from "@/themes/resolve";

// The card a chat app shows when someone pastes the link, at the size every platform expects.
export const PREVIEW_SIZE = { width: 1200, height: 630 };

// Painted without a stylesheet, so it reads the theme's resolved colours directly. A curated
// gradient is used as it is written; a photographic background is not fetched here, so its
// accent and tone stand in for it. A host's upload is drawn itself, from its card rendition
// (`picture`, a data URL), shaded into the tone's base colour behind the words.
function backdrop(theme: ResolvedTheme): string {
  const base = TONE_BASE[theme.textTone];
  return theme.background.kind === "gradient" ? theme.background.css : `linear-gradient(150deg, ${theme.accent} 0%, ${base} 70%)`;
}

function shade(theme: ResolvedTheme): string {
  const [r, g, b] = hexToRgb(TONE_BASE[theme.textTone]);
  const at = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return `linear-gradient(to top, ${at(0.92)} 0%, ${at(0.7)} 50%, ${at(0.15)} 100%)`;
}

export function previewCard(event: EventWithHost, theme: ResolvedTheme, when: string, picture?: string): ReactElement {
  return (
    <div
      style={{
        position: "relative",
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
      {picture && (
        // next/og draws a plain img; there is no next/image here, and the card has no reader.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" width={PREVIEW_SIZE.width} height={PREVIEW_SIZE.height} style={{ position: "absolute", top: 0, left: 0 }} />
      )}
      {picture && <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: shade(theme) }} />}
      <div style={{ display: "flex", fontSize: 30, opacity: 0.75, letterSpacing: 6, textTransform: "uppercase" }}>
        {event.hostName}
      </div>
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700, lineHeight: 1.05, marginTop: 16 }}>{event.title}</div>
      <div style={{ display: "flex", fontSize: 36, opacity: 0.85, marginTop: 24 }}>{when}</div>
    </div>
  );
}
