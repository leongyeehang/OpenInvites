import type { Template } from "./template";

// Made for the Broadsheet layout, which ships in M2. Until then it applies with the Poster layout.
export const supperClub: Template = {
  id: "supper",
  theme: {
    layout: "broadsheet",
    backgroundId: "midnight",
    titlePlacement: "below",
    font: "serif",
    accentOverride: "#ffc36b",
    textTone: "auto",
    buttonStyle: "solid",
    rsvpStyle: "inline",
    effect: "none",
  },
};
