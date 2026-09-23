import type { Template } from "./template";

// The prototype set its accent to #d9d9e3, which is Slate's own; auto gives the same colour and
// keeps the accent row's choice visible.
export const quiet: Template = {
  id: "quiet",
  name: "Quiet",
  blurb: "Slate, a grotesque title, near-white and outline buttons. Nothing moves.",
  theme: {
    layout: "poster",
    backgroundId: "slate",
    titlePlacement: "below",
    font: "grotesque",
    accentOverride: null,
    textTone: "auto",
    buttonStyle: "outline",
    rsvpStyle: "inline",
    effect: "none",
  },
};
