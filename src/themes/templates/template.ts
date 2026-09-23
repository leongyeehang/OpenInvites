import type { Theme } from "../theme";

// The shape of a template's data file. README.md in this directory explains each field and how
// to add a template.
export type Template = {
  // Stored on every event that starts from this template, so never rename one that has shipped.
  id: string;
  // What the Design drawer calls it.
  name: string;
  // One line about the look, shown when the host points at the template.
  blurb: string;
  theme: TemplateTheme;
};

// Every knob of the theme. What stays out is the host's own: their upload and how they use it.
export type TemplateTheme = Omit<Theme, "backgroundId" | "uploadId" | "uploadMode" | "template"> & {
  // A curated background's id (backgrounds.ts). A template always has one.
  backgroundId: string;
};
