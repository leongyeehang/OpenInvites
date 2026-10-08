import type { ReactElement } from "react";
import satori from "satori";
import sharp from "sharp";
import type { EventWithHost } from "@/events/repository";
import { hexToRgb } from "@/themes/legibility";
import { TONE_BASE, TONE_TEXT, type ResolvedTheme } from "@/themes/resolve";
import { cardFaces, type CardFaces } from "./card-fonts";
import { cardText } from "./card-text";

// The card a chat app shows when someone pastes the link, at the size every platform expects.
export const PREVIEW_SIZE = { width: 1200, height: 630 };

// Painted without a stylesheet, so it reads the theme's resolved colours directly. A curated
// gradient, and Colour wash, is used as it is written; a photographic background is not fetched
// here, so its accent and tone stand in for it. A host's upload is drawn itself, from its card
// rendition (`picture`, a data URL; blurred under Soft blur, blurredForCard), shaded into the
// tone's base colour behind the words.
function backdrop(theme: ResolvedTheme): string {
  const base = TONE_BASE[theme.textTone];
  return theme.background.kind === "gradient" ? theme.background.css : `linear-gradient(150deg, ${theme.accent} 0%, ${base} 70%)`;
}

function shade(theme: ResolvedTheme): string {
  const [r, g, b] = hexToRgb(TONE_BASE[theme.textTone]);
  const at = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  return `linear-gradient(to top, ${at(0.92)} 0%, ${at(0.7)} 50%, ${at(0.15)} 100%)`;
}

// The page blurs the picture's small copy by 64 CSS pixels (themed-page.tsx, blur-3xl), and the
// card is about as wide as a desktop screen, so the same blur leaves the same wash of colour.
const PAGE_BLUR = 64;

// Soft blur on the card: the card rendition blurred as the page blurs the copy. Satori blurs only
// what is on its canvas, so its own blur would fade the card's edges into the backdrop; this
// carries the picture's colours out to them.
export function blurredForCard(card: Uint8Array): Promise<Buffer> {
  return sharp(card).blur(PAGE_BLUR).jpeg().toBuffer();
}

type CardEvent = Pick<EventWithHost, "title" | "hostName">;

// The card as a PNG, drawn by Satori in the card's own faces and nothing fetched: the title in
// its theme's title face, the rest in the text face (card-fonts.ts), and only what they can draw
// (card-text.ts).
export async function drawPreviewCard(event: CardEvent, theme: ResolvedTheme, when: string, picture?: string): Promise<Buffer> {
  const faces = await cardFaces(theme.font.key);
  const svg = await satori(card(event, theme, when, faces, picture), { ...PREVIEW_SIZE, fonts: faces.fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function card(event: CardEvent, theme: ResolvedTheme, when: string, faces: CardFaces, picture?: string): ReactElement {
  const write = (text: string) => cardText(text, faces.canDraw);
  const text = { fontFamily: faces.text.name, fontWeight: faces.text.weight };
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
        // Satori draws a plain img; there is no next/image here, and the card has no reader.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" width={PREVIEW_SIZE.width} height={PREVIEW_SIZE.height} style={{ position: "absolute", top: 0, left: 0 }} />
      )}
      {picture && <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: shade(theme) }} />}
      <div style={{ ...text, display: "flex", fontSize: 30, opacity: 0.75, letterSpacing: 6, textTransform: "uppercase" }}>{write(event.hostName)}</div>
      <div style={{ display: "flex", fontFamily: faces.title.name, fontWeight: faces.title.weight, fontSize: 88, lineHeight: 1.05, marginTop: 16 }}>
        {write(event.title)}
      </div>
      <div style={{ ...text, display: "flex", fontSize: 36, opacity: 0.85, marginTop: 24 }}>{write(when)}</div>
    </div>
  );
}
