import type { Template } from "./template";

// Made for the Thread layout, which ships in M2. Until then it applies with the Poster layout.
export const kidsParty: Template = {
  id: "kids",
  theme: {
    layout: "thread",
    backgroundId: "dusk",
    titlePlacement: "below",
    font: "rounded",
    accentOverride: "#ff7a59",
    textTone: "auto",
    buttonStyle: "solid",
    rsvpStyle: "inline",
    effect: "confetti",
  },
};
