// The six accent colours a host may pick instead of the automatic one (spec, story 38), from the
// prototype. Data, like the backgrounds: the drawer names each by its id (messages/en.json,
// DesignDrawer.swatches), and legibility.ts makes sure every one reads on every background.
export const SWATCHES = [
  { id: "marigold", hex: "#ffc36b" },
  { id: "pink", hex: "#ff8fc0" },
  { id: "mint", hex: "#8fe6c2" },
  { id: "periwinkle", hex: "#a5b4fc" },
  { id: "coral", hex: "#ff7a59" },
  { id: "white", hex: "#ffffff" },
] as const;

export type Swatch = (typeof SWATCHES)[number];

export function isSwatch(hex: unknown): hex is Swatch["hex"] {
  return SWATCHES.some((swatch) => swatch.hex === hex);
}
