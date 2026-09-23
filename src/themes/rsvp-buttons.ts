import { cn } from "@/lib/utils";
import type { ButtonStyle } from "./theme";

// The RSVP button style knob (spec, "Themes and templates"): frosted glass, the accent filled
// in, or an outline. The chosen answer is filled in the accent whichever style is set and ringed
// in the tone's text colour, so the guest can always see what they picked, in the solid style
// too. The others stay as they are rather than fading: they can still be chosen, and faded
// labels stop reading on some backgrounds. Each style sits on a surface legibility.ts accounts
// for: glass on strong glass, solid on the opaque accent, and outline on the page's veil, which
// is clear wherever bare text already reads.
const BASE =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl px-3 text-sm font-medium transition-[background-color,opacity,border-color] outline-none focus-visible:ring-2 focus-visible:ring-theme-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-default disabled:opacity-50";

const UNSELECTED: Record<ButtonStyle, string> = {
  glass: "border border-theme-glass-border bg-theme-glass-strong backdrop-blur-xl hover:bg-theme-glass",
  solid: "bg-theme-accent text-theme-on-accent hover:opacity-90",
  outline: "border border-current/40 bg-theme-veil backdrop-blur-xl hover:border-current/70",
};

export function rsvpButtonClasses(style: ButtonStyle, { selected }: { selected: boolean }) {
  return cn(BASE, selected ? "bg-theme-accent text-theme-on-accent ring-2 ring-theme-text" : UNSELECTED[style]);
}
