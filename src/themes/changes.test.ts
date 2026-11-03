import { describe, expect, it } from "vitest";
import { applyChange, changedLook, parseThemeChange, showNewUpload, type ThemeChange } from "./changes";
import { findGalleryPoster } from "./posters";
import { applyPosterLook, DEFAULT_THEME, type Theme } from "./theme";

const gallery = (id: string) => findGalleryPoster(id)!;
const UPLOAD = "0192f0a1-7b3c-7d4e-8f00-123456789abc";
const withUpload: Theme = { ...DEFAULT_THEME, poster: { kind: "upload" } };
// A theme that started from a gallery poster's look: Candles, the Birthday template's poster.
const candles = applyPosterLook(DEFAULT_THEME, gallery("candles"));

describe("picking a gallery poster", () => {
  it("gives a new event the Birthday template's look on Golden hour, started from no poster", () => {
    expect(DEFAULT_THEME).toEqual({
      layout: "poster",
      poster: { kind: "colour", id: "golden" },
      titlePlacement: "below",
      font: "serif",
      accentOverride: null,
      textTone: "auto",
      buttonStyle: "glass",
      rsvpStyle: "sheet",
      effect: "sparkles",
      template: null,
    });
  });

  it("shows the poster with its look, its accent on Auto, and records the look as not dirty", () => {
    const own: Theme = { ...DEFAULT_THEME, accentOverride: "#ffffff", textTone: "dark", rsvpStyle: "inline", layout: "thread" };
    expect(applyChange(own, { knob: "poster", value: { kind: "gallery", id: "disco" } })).toEqual({
      layout: "thread",
      poster: { kind: "gallery", id: "disco" },
      titlePlacement: "on",
      font: "display",
      accentOverride: null,
      textTone: "dark",
      buttonStyle: "glass",
      rsvpStyle: "inline",
      effect: "sparkles",
      template: { posterId: "disco", dirty: false },
    });
  });

  it("brings each poster's own look over another's", () => {
    const balloons = applyChange(candles, { knob: "poster", value: { kind: "gallery", id: "balloons" } });
    expect(balloons).toMatchObject({ ...gallery("balloons").look, poster: { kind: "gallery", id: "balloons" }, template: { posterId: "balloons", dirty: false } });
  });

  it("changes nothing when the poster is already on and its look untouched", () => {
    expect(applyChange(candles, { knob: "poster", value: { kind: "gallery", id: "candles" } })).toBe(candles);
  });

  it("brings the look back when the host picks the poster again after changing it", () => {
    const changed = applyChange(applyChange(candles, { knob: "font", value: "rounded" }), { knob: "accentOverride", value: "#ffffff" });
    expect(changed.template).toEqual({ posterId: "candles", dirty: true });
    expect(applyChange(changed, { knob: "poster", value: { kind: "gallery", id: "candles" } })).toEqual(candles);
  });

  it("keeps the host's picture on the event, to go back to", () => {
    const fromPicture = applyChange(withUpload, { knob: "poster", value: { kind: "gallery", id: "rings" } });
    expect(applyChange(fromPicture, { knob: "poster", value: { kind: "upload" } }).poster).toEqual({ kind: "upload" });
  });
});

describe("the look to restore", () => {
  it("is the poster on show once the host has changed its look", () => {
    expect(changedLook(applyChange(candles, { knob: "buttonStyle", value: "solid" }))).toBe("candles");
  });

  it("is nothing while the look is untouched, the poster is another, or none was picked", () => {
    expect(changedLook(candles)).toBeUndefined();
    expect(changedLook(applyChange(candles, { knob: "poster", value: { kind: "colour", id: "dusk" } }))).toBeUndefined();
    expect(changedLook(applyChange(DEFAULT_THEME, { knob: "font", value: "rounded" }))).toBeUndefined();
  });
});

describe("changing a knob", () => {
  const changes: [ThemeChange, Partial<Theme>][] = [
    [{ knob: "poster", value: { kind: "colour", id: "dusk" } }, { poster: { kind: "colour", id: "dusk" } }],
    [{ knob: "poster", value: { kind: "upload" } }, { poster: { kind: "upload" } }],
    [{ knob: "font", value: "display" }, { font: "display" }],
    [{ knob: "accentOverride", value: "#8fe6c2" }, { accentOverride: "#8fe6c2" }],
    [{ knob: "textTone", value: "dark" }, { textTone: "dark" }],
    [{ knob: "buttonStyle", value: "outline" }, { buttonStyle: "outline" }],
    [{ knob: "rsvpStyle", value: "inline" }, { rsvpStyle: "inline" }],
    [{ knob: "titlePlacement", value: "on" }, { titlePlacement: "on" }],
    [{ knob: "effect", value: "doodles" }, { effect: "doodles" }],
    [{ knob: "layout", value: "broadsheet" }, { layout: "broadsheet" }],
    [{ knob: "layout", value: "thread" }, { layout: "thread" }],
  ];

  it.each(changes)("sets the knob and marks the poster's look dirty: %j", (change, knob) => {
    expect(applyChange(candles, change)).toEqual({ ...candles, ...knob, template: { posterId: "candles", dirty: true } });
  });

  it("puts the accent back on auto when the poster changes, so it matches the new picture", () => {
    const white = applyChange(candles, { knob: "accentOverride", value: "#ffffff" });
    expect(applyChange(white, { knob: "poster", value: { kind: "colour", id: "dusk" } }).accentOverride).toBeNull();
    expect(applyChange(white, { knob: "poster", value: { kind: "upload" } }).accentOverride).toBeNull();
  });

  it("goes back and forth between the host's picture and a colour, nothing else changing", () => {
    const onDusk = applyChange(withUpload, { knob: "poster", value: { kind: "colour", id: "dusk" } });
    expect(onDusk).toEqual({ ...withUpload, poster: { kind: "colour", id: "dusk" } });
    expect(applyChange(onDusk, { knob: "poster", value: { kind: "upload" } })).toEqual(withUpload);
  });

  describe("a new picture", () => {
    it("is shown as the poster with the accent back on auto, whatever was shown before", () => {
      const white = applyChange(candles, { knob: "accentOverride", value: "#ffffff" });
      expect(showNewUpload(white)).toEqual({ ...candles, poster: { kind: "upload" }, accentOverride: null, template: { posterId: "candles", dirty: true } });
    });

    it("brings its own accent even when it replaces a picture that was the poster already", () => {
      const ownAccent = applyChange(withUpload, { knob: "accentOverride", value: "#8fe6c2" });
      expect(showNewUpload(ownAccent)).toMatchObject({ poster: { kind: "upload" }, accentOverride: null });
    });

    it("keeps where the host put the title", () => {
      const titleOn = applyChange(withUpload, { knob: "titlePlacement", value: "on" });
      expect(showNewUpload(titleOn).titlePlacement).toBe("on");
    });
  });

  it("changes nothing, dirty flag included, when the host picks what is already chosen", () => {
    expect(applyChange(DEFAULT_THEME, { knob: "font", value: "serif" })).toBe(DEFAULT_THEME);
    expect(applyChange(DEFAULT_THEME, { knob: "poster", value: { kind: "colour", id: "golden" } })).toBe(DEFAULT_THEME);
    expect(applyChange(DEFAULT_THEME, { knob: "accentOverride", value: null })).toBe(DEFAULT_THEME);
    expect(applyChange(withUpload, { knob: "poster", value: { kind: "upload" } })).toBe(withUpload);
  });

  it("keeps every other knob, the RSVP style included, when the layout changes and changes back", () => {
    const own = [
      { knob: "poster", value: { kind: "colour", id: "dusk" } },
      { knob: "font", value: "display" },
      { knob: "rsvpStyle", value: "inline" },
      { knob: "effect", value: "confetti" },
    ].reduce<Theme>((theme, change) => applyChange(theme, change as ThemeChange), DEFAULT_THEME);
    const broadsheet = applyChange(own, { knob: "layout", value: "broadsheet" });
    expect(broadsheet).toEqual({ ...own, layout: "broadsheet" });
    expect(applyChange(broadsheet, { knob: "layout", value: "poster" })).toEqual(own);
  });

  it("leaves a theme that started from no poster's look without one", () => {
    expect(applyChange(DEFAULT_THEME, { knob: "font", value: "rounded" }).template).toBeNull();
  });
});

describe("reading a change the drawer sent", () => {
  it("accepts every change the drawer offers", () => {
    const offered: ThemeChange[] = [
      { knob: "poster", value: { kind: "gallery", id: "aurora" } },
      { knob: "poster", value: { kind: "gallery", id: "sunset-drive" } },
      { knob: "poster", value: { kind: "colour", id: "lagoon" } },
      { knob: "poster", value: { kind: "colour", id: "midnight" } },
      { knob: "font", value: "grotesque" },
      { knob: "accentOverride", value: "#ff7a59" },
      { knob: "accentOverride", value: null },
      { knob: "textTone", value: "auto" },
      { knob: "buttonStyle", value: "solid" },
      { knob: "rsvpStyle", value: "sheet" },
      { knob: "rsvpStyle", value: "inline" },
      { knob: "titlePlacement", value: "on" },
      { knob: "titlePlacement", value: "below" },
      { knob: "effect", value: "none" },
      { knob: "effect", value: "confetti" },
      { knob: "effect", value: "sparkles" },
      { knob: "effect", value: "doodles" },
      { knob: "layout", value: "poster" },
      { knob: "layout", value: "broadsheet" },
      { knob: "layout", value: "thread" },
    ];
    for (const change of offered) expect(parseThemeChange(JSON.parse(JSON.stringify(change)))).toEqual(change);
  });

  it("accepts the event's upload as the poster only when it has one", () => {
    expect(parseThemeChange({ knob: "poster", value: { kind: "upload" } }, UPLOAD)).toEqual({ knob: "poster", value: { kind: "upload" } });
    expect(parseThemeChange({ knob: "poster", value: { kind: "upload" } }, null)).toBeUndefined();
    expect(parseThemeChange({ knob: "poster", value: { kind: "upload" } })).toBeUndefined();
  });

  it("accepts a curated poster only as the kind it is, and keeps nothing else the browser sent with it", () => {
    expect(parseThemeChange({ knob: "poster", value: { kind: "colour", id: "aurora" } })).toBeUndefined();
    expect(parseThemeChange({ knob: "poster", value: { kind: "gallery", id: "golden" } })).toBeUndefined();
    expect(parseThemeChange({ knob: "poster", value: { kind: "gallery", id: "bokeh", src: "https://elsewhere" } })).toEqual({
      knob: "poster",
      value: { kind: "gallery", id: "bokeh" },
    });
  });

  it("no longer takes the backgrounds 0.4 made from the host's picture, or the old background and upload knobs", () => {
    expect(parseThemeChange({ knob: "poster", value: { kind: "colour", id: "upload-blur" } }, UPLOAD)).toBeUndefined();
    expect(parseThemeChange({ knob: "backgroundId", value: "upload-wash" }, UPLOAD)).toBeUndefined();
    expect(parseThemeChange({ knob: "backgroundId", value: "golden" })).toBeUndefined();
    expect(parseThemeChange({ knob: "uploadMode", value: "poster" }, UPLOAD)).toBeUndefined();
    expect(parseThemeChange({ knob: "uploadId", value: UPLOAD }, UPLOAD)).toBeUndefined();
  });

  it("refuses anything else", () => {
    const refused: unknown[] = [
      null,
      "festival",
      // Templates are gallery posters' looks now, applied by picking the poster.
      { template: "festival" },
      { knob: "poster", value: { kind: "gallery", id: "festival" } },
      { knob: "poster", value: { kind: "colour", id: "nope" } },
      { knob: "poster", value: { kind: "emoji" } },
      { knob: "poster", value: null },
      { knob: "poster", value: "golden" },
      { knob: "font", value: "comic" },
      // Only the six swatches: a colour the drawer never offered could be one nobody checked.
      { knob: "accentOverride", value: "#123456" },
      { knob: "textTone", value: "sepia" },
      { knob: "buttonStyle", value: "neon" },
      { knob: "rsvpStyle", value: "modal" },
      { knob: "rsvpStyle", value: null },
      { knob: "titlePlacement", value: "above" },
      { knob: "titlePlacement", value: null },
      { knob: "effect", value: "fireworks" },
      { knob: "effect", value: null },
      // Only the layouts there are.
      { knob: "layout", value: "zine" },
      { knob: "layout", value: null },
      { knob: "uploadId", value: "0192f0a1-7b3c-7d4e-8f00-123456789abc" },
      { knob: "template", value: { id: "birthday", dirty: false } },
    ];
    for (const change of refused) expect(parseThemeChange(change), JSON.stringify(change)).toBeUndefined();
  });
});
