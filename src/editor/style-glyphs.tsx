import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SectionStyle } from "@/sections";

// A small drawing of each display style a section offers (M8 ticket 30), in the colour of the text
// around it, a second shape fainter: the Arrange sheet's swatches draw it large, and the editor's
// placeholders small beside the style's name. Decorative: the name beside it says the style.
const SHAPES: Record<SectionStyle, ReactNode> = {
  // Three columns of equal squares.
  grid: [4, 18, 32].flatMap((x) => [2, 16].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="12" rx="2" />)),
  // The first item two columns wide and two rows high, the rest beside it.
  mosaic: (
    <>
      <rect x="4" y="2" width="26" height="26" rx="2" />
      <rect x="32" y="2" width="12" height="12" rx="2" opacity="0.55" />
      <rect x="32" y="16" width="12" height="12" rx="2" opacity="0.55" />
    </>
  ),
  // One row, the last tile running off the edge, as it scrolls sideways.
  strip: (
    <>
      {[0, 15, 30, 45].map((x) => (
        <rect key={x} x={x} y="7" width="13" height="16" rx="2" opacity={x > 30 ? 0.55 : 1} />
      ))}
    </>
  ),
  // Lines of text, each under a short name.
  list: [3, 17].map((y) => (
    <g key={y}>
      <rect x="4" y={y} width="14" height="3" rx="1.5" />
      <rect x="4" y={y + 5} width="40" height="3" rx="1.5" opacity="0.55" />
    </g>
  )),
  // A guest's bubble on the left, faint; a host's on the right.
  bubbles: (
    <>
      <rect x="2" y="3" width="28" height="10" rx="5" opacity="0.55" />
      <rect x="18" y="17" width="28" height="10" rx="5" />
    </>
  ),
  // Names as chips, each with its dot.
  names: [
    [2, 3, 20],
    [24, 3, 22],
    [2, 17, 26],
  ].map(([x, y, width]) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={width} height="10" rx="5" opacity="0.55" />
      <circle cx={x + 5} cy={y + 5} r="2" />
    </g>
  )),
  // A circle over a short name.
  avatars: [8, 24, 40].map((cx) => (
    <g key={cx}>
      <circle cx={cx} cy="11" r="6.5" />
      <rect x={cx - 5} y="21" width="10" height="3" rx="1.5" opacity="0.55" />
    </g>
  )),
};

export function StyleGlyph({ style, className }: { style: SectionStyle; className?: string }) {
  return (
    <svg data-glyph={style} viewBox="0 0 48 30" fill="currentColor" aria-hidden className={cn("shrink-0", className)}>
      {SHAPES[style]}
    </svg>
  );
}
