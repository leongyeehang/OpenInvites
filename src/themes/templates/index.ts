import { birthday } from "./birthday";
import { festival } from "./festival";
import { kidsParty } from "./kids-party";
import { quiet } from "./quiet";
import { supperClub } from "./supper-club";
import type { Template } from "./template";
import { vows } from "./vows";

export type { Template, TemplateTheme } from "./template";

// The templates that ship, in the order the Design drawer shows them. A new template is a file
// in this directory and one line here (README.md).
export const TEMPLATES: readonly Template[] = [birthday, vows, supperClub, kidsParty, festival, quiet];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
