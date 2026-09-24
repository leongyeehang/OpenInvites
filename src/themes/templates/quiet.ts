import type { Template } from "./template";

// The prototype set its accent to #d9d9e3, which is Slate's own; auto gives the same colour and
// keeps the accent row's choice visible.
export const quiet: Template = {
  id: "quiet",
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
