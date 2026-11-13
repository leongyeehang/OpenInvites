// The sections' one public entry (ADR-0008): the rest of the app imports "@/sections", never a
// file inside it. It is pure and client-safe: the arrangement's rules, and the registry's half
// that says what each kind of section is called and offers, which the Arrange sheet reads. What a
// section loads and how it is drawn is registered on the server, in
// src/themes/sections/drawings.ts (ticket 25).
export * from "./arrangement";
export * from "./registry";
