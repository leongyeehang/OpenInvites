import { describe, expect, it } from "vitest";
import { applyChange, parseThemeChange, showNewUpload, themeReadout, type ThemeChange } from "./changes";
import { findTemplate } from "./templates";
import { applyTemplate, DEFAULT_THEME, type Theme } from "./theme";

const template = (id: string) => findTemplate(id)!;
const UPLOAD = "0192f0a1-7b3c-7d4e-8f00-123456789abc";
const withUpload: Theme = { ...DEFAULT_THEME, poster: { kind: "upload" } };

describe("applying a template", () => {
  it("gives a new event the Birthday template, not yet changed", () => {
    expect(DEFAULT_THEME).toEqual(applyTemplate(null, template("birthday")));
    expect(DEFAULT_THEME.template).toEqual({ id: "birthday", dirty: false });
  });

  it("copies every knob the template sets and records it as not dirty", () => {
    expect(applyTemplate(DEFAULT_THEME, template("vows"))).toEqual({
      layout: "poster",
      poster: { kind: "gallery", id: "rose" },
      titlePlacement: "below",
      font: "serif",
      accentOverride: "#ffffff",
      textTone: "auto",
      buttonStyle: "outline",
      rsvpStyle: "sheet",
      effect: "sparkles",
      template: { id: "vows", dirty: false },
    });
  });

  it("shows the template's background as the poster, a gradient as a colour and a scene as a gallery poster", () => {
    expect(applyTemplate(withUpload, template("quiet")).poster).toEqual({ kind: "colour", id: "slate" });
    expect(applyTemplate(withUpload, template("festival")).poster).toEqual({ kind: "gallery", id: "aurora" });
  });

  it("applies Supper club with the Broadsheet layout and Kids' party with the Thread layout", () => {
    expect(applyTemplate(DEFAULT_THEME, template("supper")).layout).toBe("broadsheet");
    expect(applyTemplate(DEFAULT_THEME, template("kids")).layout).toBe("thread");
  });

  it("brings its own layout when applied over another, as it does every knob", () => {
    const supper = applyTemplate(DEFAULT_THEME, template("supper"));
    expect(applyTemplate(supper, template("birthday")).layout).toBe("poster");
  });

  it("changes nothing when the template is already on and untouched", () => {
    expect(applyChange(DEFAULT_THEME, { template: "birthday" })).toBe(DEFAULT_THEME);
  });

  it("resets every change when the host applies the same template again", () => {
    const changed = applyChange(applyChange(DEFAULT_THEME, { knob: "font", value: "rounded" }), { knob: "textTone", value: "dark" });
    expect(changed.template).toEqual({ id: "birthday", dirty: true });
    expect(applyChange(changed, { template: "birthday" })).toEqual(DEFAULT_THEME);
  });
});

describe("changing a knob", () => {
  const changes: [ThemeChange, Partial<Theme>][] = [
    [{ knob: "poster", value: { kind: "colour", id: "dusk" } }, { poster: { kind: "colour", id: "dusk" } }],
    [{ knob: "poster", value: { kind: "gallery", id: "bokeh" } }, { poster: { kind: "gallery", id: "bokeh" } }],
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

  it.each(changes)("sets the knob and marks the template dirty: %j", (change, knob) => {
    expect(applyChange(DEFAULT_THEME, change)).toEqual({ ...DEFAULT_THEME, ...knob, template: { id: "birthday", dirty: true } });
  });

  it("puts the accent back on auto when the poster changes, so it matches the new picture", () => {
    const vows = applyTemplate(DEFAULT_THEME, template("vows"));
    expect(applyChange(vows, { knob: "poster", value: { kind: "colour", id: "dusk" } }).accentOverride).toBeNull();
    expect(applyChange(vows, { knob: "poster", value: { kind: "upload" } }).accentOverride).toBeNull();
  });

  it("goes back and forth between the host's picture and a curated poster, nothing else changing", () => {
    const onDusk = applyChange(withUpload, { knob: "poster", value: { kind: "colour", id: "dusk" } });
    expect(onDusk).toEqual({ ...withUpload, poster: { kind: "colour", id: "dusk" }, template: { id: "birthday", dirty: true } });
    expect(applyChange(onDusk, { knob: "poster", value: { kind: "upload" } })).toEqual({ ...withUpload, template: { id: "birthday", dirty: true } });
  });

  describe("a new picture", () => {
    it("is shown as the poster with the accent back on auto, whatever was shown before", () => {
      const vows = applyTemplate(DEFAULT_THEME, template("vows"));
      expect(showNewUpload(vows)).toEqual({ ...vows, poster: { kind: "upload" }, accentOverride: null, template: { id: "vows", dirty: true } });
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

  it("leaves a theme that started from no template without one", () => {
    const own: Theme = { ...DEFAULT_THEME, template: null };
    expect(applyChange(own, { knob: "font", value: "rounded" }).template).toBeNull();
  });
});

describe("the theme readout", () => {
  it("points at the template while nothing has changed", () => {
    expect(themeReadout(DEFAULT_THEME)).toEqual({ custom: false, template: "birthday" });
  });

  it("says custom, started from the template, once a knob has changed", () => {
    expect(themeReadout(applyChange(DEFAULT_THEME, { knob: "buttonStyle", value: "solid" }))).toEqual({ custom: true, template: "birthday" });
  });

  it("says custom alone when there is no template, or it is no longer shipped", () => {
    expect(themeReadout({ ...DEFAULT_THEME, template: null })).toEqual({ custom: true });
    expect(themeReadout({ ...DEFAULT_THEME, template: { id: "retired", dirty: false } })).toEqual({ custom: true });
  });
});

describe("reading a change the drawer sent", () => {
  it("accepts every change the drawer offers", () => {
    const offered: ThemeChange[] = [
      { template: "festival" },
      { knob: "poster", value: { kind: "gallery", id: "aurora" } },
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
      { template: "zine" },
      { template: 7 },
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
