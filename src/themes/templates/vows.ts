import type { Template } from "./template";

// Guests answer in the sheet, like a reply card laid over the invitation, so the invitation
// itself is never pushed down the page. (The prototype had it inline.)
export const vows: Template = {
  id: "vows",
  name: "Vows",
  blurb: "Rose garden, a serif title, white accent and outline buttons.",
  theme: {
    layout: "poster",
    backgroundId: "rose",
    titlePlacement: "below",
    font: "serif",
    accentOverride: "#ffffff",
    textTone: "auto",
    buttonStyle: "outline",
    rsvpStyle: "sheet",
    effect: "sparkles",
  },
};
