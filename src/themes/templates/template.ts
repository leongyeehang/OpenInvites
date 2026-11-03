import type en from "../../../messages/en.json";
import type { Theme } from "../theme";

// A template's id. What the Design drawer calls it, and the line about its look, are messages
// (DesignDrawer.templateNames and templateBlurbs, in every file in messages/), so the id has to
// be one they name.
export type TemplateId = keyof typeof en.DesignDrawer.templateNames;

// The shape of a template's data file. docs/contributing/templates.md explains each field and
// how to add a template.
export type Template = {
  // Stored on every event that starts from this template, so never rename one that has shipped.
  id: TemplateId;
  theme: TemplateTheme;
};

// Every knob of the theme but the poster, which a template names by its curated background.
export type TemplateTheme = Omit<Theme, "poster" | "template"> & {
  // A curated background's id (backgrounds.ts), shown as the poster. A template always has one.
  backgroundId: string;
};
