import { cn } from "@/lib/utils";
import type { ButtonStyle } from "./theme";

// The RSVP button style knob (spec, "Themes and templates"): frosted glass, the accent filled
// in, or an outline. The chosen answer is filled in the accent whichever style is set and ringed
// in the tone's text colour, so the guest can always see what they picked, in the solid style
// too. The others stay as they are rather than fading: they can still be chosen, and faded
// labels stop reading on some backgrounds. Each style sits on a surface legibility.ts accounts
// for: glass on strong glass, solid on the opaque accent, and outline on the page's veil, which
// is clear wherever bare text already reads. The buttons sit on the backdrop itself, which can be
// anything, so the keyboard's focus rings them inside, in their label's own colour, which reads
// on their own surface at AA and so stands out from it at well over 3:1.
const BASE =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl px-3 text-sm font-medium transition-[background-color,opacity,border-color] motion-reduce:transition-none focus-visible:outline-current focus-visible:-outline-offset-4 disabled:cursor-default disabled:opacity-50";

const UNSELECTED: Record<ButtonStyle, string> = {
  glass: "border border-theme-glass-border bg-theme-glass-strong backdrop-blur-xl hover:bg-theme-glass",
  solid: "bg-theme-accent text-theme-on-accent hover:opacity-90",
  outline: "border border-current/40 bg-theme-veil backdrop-blur-xl hover:border-current/70",
};

export function rsvpButtonClasses(style: ButtonStyle, { selected }: { selected: boolean }) {
  return cn(BASE, selected ? "bg-theme-accent text-theme-on-accent ring-2 ring-theme-text" : UNSELECTED[style]);
}

// The same style on a button set inside a glass card rather than on the backdrop: the Broadsheet's
// "Post my reply", on its ballot. Glass is strong glass on the card (legibility.ts, SURFACES.inset)
// and solid is the accent, as above; outline has no veil behind it, since the card under its label
// is already a surface the tone's text reads on (SURFACES.card). Focus rings it inside, as above.
export function cardButtonClasses(style: ButtonStyle) {
  return cn(BASE, style === "outline" ? "border-2 border-current/40 hover:border-current/70" : UNSELECTED[style]);
}
