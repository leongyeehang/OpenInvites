import { cn } from "@/lib/utils";
import type { ButtonStyle } from "./theme";

// The RSVP button style knob (spec, "Themes and templates"): frosted glass, the accent filled
// in, or an outline. The chosen answer is filled in the accent whichever style is set, so the
// guest can always see what they picked; the others step back.
const BASE =
  "inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl px-3 text-sm font-medium transition-[background-color,opacity,border-color] outline-none focus-visible:ring-2 focus-visible:ring-theme-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-default disabled:opacity-50";

const UNSELECTED: Record<ButtonStyle, string> = {
  glass: "border border-theme-glass-border bg-theme-glass-strong backdrop-blur-xl hover:bg-theme-glass",
  solid: "bg-theme-accent/85 text-theme-on-accent hover:bg-theme-accent",
  outline: "border border-current/40 hover:border-current/70",
};

export function rsvpButtonClasses(style: ButtonStyle, { selected, dimmed }: { selected: boolean; dimmed: boolean }) {
  return cn(BASE, selected ? "bg-theme-accent text-theme-on-accent" : UNSELECTED[style], dimmed && "opacity-60");
}
