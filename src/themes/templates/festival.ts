import type { Template } from "./template";

// Round one's B (PROTOTYPE.md): Bricolage Grotesque, the inline RSVP, and the doodles, which
// render from M2 with the other effects.
export const festival: Template = {
  id: "festival",
  name: "Festival",
  blurb: "Aurora, a heavy grotesque title and glass buttons.",
  theme: {
    layout: "poster",
    backgroundId: "aurora",
    titlePlacement: "below",
    font: "grotesque",
    accentOverride: null,
    textTone: "auto",
    buttonStyle: "glass",
    rsvpStyle: "inline",
    effect: "doodles",
  },
};
