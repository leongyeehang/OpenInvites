import type { Template } from "./template";

// Round one's A (PROTOTYPE.md): Golden hour, one large serif title, frosted glass, restraint.
// Every new event starts here.
export const birthday: Template = {
  id: "birthday",
  name: "Birthday",
  blurb: "Golden hour, a large serif title and frosted glass buttons.",
  theme: {
    layout: "poster",
    backgroundId: "golden",
    titlePlacement: "below",
    font: "serif",
    accentOverride: null,
    textTone: "auto",
    buttonStyle: "glass",
    rsvpStyle: "sheet",
    effect: "sparkles",
  },
};
