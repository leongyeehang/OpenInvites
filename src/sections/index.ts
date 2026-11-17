// The sections' one public entry (ADR-0008): the rest of the app imports "@/sections", never a
// file inside it. It is pure and client-safe: the arrangement's rules, and the registry's half
// that says what each kind of section is called and offers, which the Arrange sheet reads. What a
// section loads and how it is drawn is registered on the server, in
// src/themes/sections/drawings.ts (ticket 25). It gives only what the rest of the app uses, with
// the types those signatures name (the Sections part's review, as voting's entry does): a narrow
// entry is what lets the module be lifted out.
export {
  applyArrangementChange,
  clipCharacters,
  countdownOn,
  kindOffered,
  linkHost,
  linksToDraw,
  parseArrangement,
  parseArrangementChange,
  placedSections,
  refusedBySwitches,
  safeLinkUrl,
  SECTION_LIMITS,
  sectionFeature,
  sectionId,
  sectionKey,
  sectionOn,
  sheetRows,
  switchesAfter,
  tidyHeading,
  type Arrangement,
  type ArrangementChange,
  type ArrangementError,
  type BuiltInKind,
  type OfferedFeatures,
  type PlacedSection,
  type Section,
  type SectionKind,
  type SectionLink,
  type SectionStyle,
  type SheetRow,
  type Shown,
  type Switches,
} from "./arrangement";
export { REGISTRY, type ReadySection, type SectionDrawing, type SectionHeading } from "./registry";
