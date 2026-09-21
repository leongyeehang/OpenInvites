import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, type Theme } from "./theme";

describe("parseTheme", () => {
  it("gives an event with no theme the Birthday template's look", () => {
    expect(parseTheme({})).toEqual({
      layout: "poster",
      backgroundId: "golden",
      uploadId: null,
      uploadMode: "background",
      titlePlacement: "below",
      font: "serif",
      accentOverride: null,
      textTone: "auto",
      buttonStyle: "glass",
      rsvpStyle: "sheet",
      effect: "sparkles",
      template: { id: "birthday", dirty: false },
    });
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme(undefined)).toEqual(DEFAULT_THEME);
  });

  it("keeps every knob it recognises", () => {
    const stored: Theme = {
      layout: "thread",
      backgroundId: "slate",
      uploadId: "0192f0a1-7b3c-7d4e-8f00-123456789abc",
      uploadMode: "poster",
      titlePlacement: "on",
      font: "rounded",
      accentOverride: "#ff7a59",
      textTone: "dark",
      buttonStyle: "outline",
      rsvpStyle: "inline",
      effect: "none",
      template: { id: "quiet", dirty: true },
    };
    expect(parseTheme(stored)).toEqual(stored);
  });

  it("falls back knob by knob on values it does not recognise", () => {
    expect(
      parseTheme({
        layout: "zine",
        backgroundId: 7,
        font: "comic",
        accentOverride: "red",
        textTone: "sepia",
        buttonStyle: "neon",
        template: "birthday",
      }),
    ).toEqual(DEFAULT_THEME);
    expect(parseTheme("poster")).toEqual(DEFAULT_THEME);
  });
});
