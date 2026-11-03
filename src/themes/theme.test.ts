import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme, type Theme } from "./theme";

describe("parseTheme", () => {
  it("gives an event with no theme the Birthday template's look", () => {
    expect(parseTheme({})).toEqual({
      layout: "poster",
      poster: { kind: "colour", id: "golden" },
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
      poster: { kind: "upload" },
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

  it("keeps a curated poster only as the kind it is, and falls back on any other", () => {
    expect(parseTheme({ poster: { kind: "gallery", id: "bokeh" } }).poster).toEqual({ kind: "gallery", id: "bokeh" });
    expect(parseTheme({ poster: { kind: "colour", id: "dusk" } }).poster).toEqual({ kind: "colour", id: "dusk" });
    expect(parseTheme({ poster: { kind: "colour", id: "bokeh" } }).poster).toEqual(DEFAULT_THEME.poster);
    expect(parseTheme({ poster: { kind: "gallery", id: "nope" } }).poster).toEqual(DEFAULT_THEME.poster);
    expect(parseTheme({ poster: { kind: "emoji", id: "x" } }).poster).toEqual(DEFAULT_THEME.poster);
    expect(parseTheme({ poster: "golden" }).poster).toEqual(DEFAULT_THEME.poster);
  });

  // Themes in the shapes 0.4 wrote them, read into the poster they amount to.
  describe("a theme written by 0.4", () => {
    const UPLOAD = "0192f0a1-7b3c-7d4e-8f00-123456789abc";
    const v04 = {
      layout: "poster",
      titlePlacement: "below",
      font: "serif",
      accentOverride: null,
      textTone: "auto",
      buttonStyle: "glass",
      rsvpStyle: "sheet",
      effect: "sparkles",
      template: { id: "birthday", dirty: true },
    };
    const cases: [string, Record<string, unknown>, Theme["poster"]][] = [
      ["a curated gradient", { backgroundId: "midnight", uploadId: null, uploadMode: "background" }, { kind: "colour", id: "midnight" }],
      ["a curated scene", { backgroundId: "sunset-sea", uploadId: null, uploadMode: "background" }, { kind: "gallery", id: "sunset-sea" }],
      ["a curated scene with a picture put aside", { backgroundId: "rose", uploadId: UPLOAD, uploadMode: "poster" }, { kind: "gallery", id: "rose" }],
      ["the picture as the background", { backgroundId: null, uploadId: UPLOAD, uploadMode: "background" }, { kind: "upload" }],
      ["the picture as the poster", { backgroundId: null, uploadId: UPLOAD, uploadMode: "poster" }, { kind: "upload" }],
      ["the picture, as guests were sent it", { backgroundId: null, uploadId: null, uploadMode: "poster" }, { kind: "upload" }],
      ["Soft blur", { backgroundId: "upload-blur", uploadId: UPLOAD, uploadMode: "background" }, { kind: "upload" }],
      ["Colour wash", { backgroundId: "upload-wash", uploadId: UPLOAD, uploadMode: "poster" }, { kind: "upload" }],
      ["Colour wash with no picture left", { backgroundId: "upload-wash", uploadId: null, uploadMode: "background" }, { kind: "colour", id: "golden" }],
      ["a background no longer shipped", { backgroundId: "retired", uploadId: null, uploadMode: "background" }, { kind: "colour", id: "golden" }],
    ];

    it.each(cases)("reads %s into its poster, every other knob kept", (_, old, poster) => {
      expect(parseTheme({ ...v04, ...old })).toEqual({ ...v04, poster });
    });
  });
});
