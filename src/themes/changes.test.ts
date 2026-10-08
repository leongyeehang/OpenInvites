import { describe, expect, it } from "vitest";
import { applyChange, parseThemeChange, themeReadout, type ThemeChange } from "./changes";
import { findTemplate } from "./templates";
import { applyTemplate, DEFAULT_THEME, type Theme } from "./theme";

const template = (id: string) => findTemplate(id)!;
const UPLOAD = "0192f0a1-7b3c-7d4e-8f00-123456789abc";
const OTHER_UPLOAD = "0192f0a1-7b3c-7d4e-8f00-000000000000";
const withUpload: Theme = { ...DEFAULT_THEME, backgroundId: null, uploadId: UPLOAD, uploadMode: "poster" };

describe("applying a template", () => {
  it("gives a new event the Birthday template, not yet changed", () => {
    expect(DEFAULT_THEME).toEqual(applyTemplate(null, template("birthday")));
    expect(DEFAULT_THEME.template).toEqual({ id: "birthday", dirty: false });
  });

  it("copies every knob the template sets and records it as not dirty", () => {
    expect(applyTemplate(DEFAULT_THEME, template("vows"))).toEqual({
      layout: "poster",
      backgroundId: "rose",
      uploadId: null,
      uploadMode: "background",
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

  it("keeps the host's upload in their gallery while showing the template's background", () => {
    const applied = applyTemplate(withUpload, template("quiet"));
    expect(applied).toMatchObject({ backgroundId: "slate", uploadId: withUpload.uploadId, uploadMode: "poster" });
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
    [{ knob: "backgroundId", value: "dusk" }, { backgroundId: "dusk" }],
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

  it("puts the accent back on auto when the background changes, so it matches the new picture", () => {
    const vows = applyTemplate(DEFAULT_THEME, template("vows"));
    expect(applyChange(vows, { knob: "backgroundId", value: "dusk" }).accentOverride).toBeNull();
  });

  it("shows the chosen background again when the host was using their upload", () => {
    expect(applyChange(withUpload, { knob: "backgroundId", value: "golden" })).toMatchObject({ backgroundId: "golden", uploadId: withUpload.uploadId });
  });

  it("shows the host's upload as the background, with the accent back on auto to match it", () => {
    const vows = applyTemplate(DEFAULT_THEME, template("vows"));
    expect(applyChange(vows, { knob: "uploadId", value: UPLOAD })).toEqual({
      ...vows,
      backgroundId: null,
      uploadId: UPLOAD,
      uploadMode: "background",
      accentOverride: null,
      template: { id: "vows", dirty: true },
    });
    // Its tile stays in the gallery after a curated background is chosen, and choosing it again
    // brings it back.
    const onDusk = applyChange(applyChange(DEFAULT_THEME, { knob: "uploadId", value: UPLOAD }), { knob: "backgroundId", value: "dusk" });
    expect(onDusk).toMatchObject({ backgroundId: "dusk", uploadId: UPLOAD });
    expect(applyChange(onDusk, { knob: "uploadMode", value: "background" })).toMatchObject({ backgroundId: null, uploadId: UPLOAD, uploadMode: "background" });
  });

  describe("the host's picture as the poster", () => {
    // The picture as the background, with the host's own accent and text tone on it.
    const asBackground = [
      { knob: "uploadId", value: UPLOAD },
      { knob: "accentOverride", value: "#8fe6c2" },
      { knob: "textTone", value: "dark" },
    ].reduce<Theme>((theme, change) => applyChange(theme, change as ThemeChange), DEFAULT_THEME);

    it("shows it as the poster, and back as the background, with nothing else changed either way", () => {
      const asPoster = applyChange(asBackground, { knob: "uploadMode", value: "poster" });
      expect(asPoster).toEqual({ ...asBackground, uploadMode: "poster" });
      expect(applyChange(asPoster, { knob: "uploadMode", value: "background" })).toEqual(asBackground);
    });

    it("brings the picture back from the gallery as the poster, with the accent back on auto to match it", () => {
      const onDusk = applyChange(applyChange(asBackground, { knob: "backgroundId", value: "dusk" }), { knob: "accentOverride", value: "#ff7a59" });
      expect(applyChange(onDusk, { knob: "uploadMode", value: "poster" })).toEqual({
        ...onDusk,
        backgroundId: null,
        uploadMode: "poster",
        accentOverride: null,
      });
    });

    it("has nothing to show on an event without an upload", () => {
      expect(applyChange(DEFAULT_THEME, { knob: "uploadMode", value: "poster" })).toBe(DEFAULT_THEME);
      expect(applyChange(DEFAULT_THEME, { knob: "uploadMode", value: "background" })).toBe(DEFAULT_THEME);
    });

    it("keeps a new picture in the use the host chose for the one it replaces", () => {
      const asPoster = applyChange(asBackground, { knob: "uploadMode", value: "poster" });
      const replaced = applyChange(asPoster, { knob: "uploadId", value: OTHER_UPLOAD });
      expect(replaced).toEqual({ ...asPoster, uploadId: OTHER_UPLOAD, accentOverride: null });
    });

    it("changes nothing when the picture is already used that way", () => {
      const asPoster = applyChange(asBackground, { knob: "uploadMode", value: "poster" });
      expect(applyChange(asPoster, { knob: "uploadMode", value: "poster" })).toBe(asPoster);
      expect(applyChange(asBackground, { knob: "uploadMode", value: "background" })).toBe(asBackground);
      expect(applyChange(asPoster, { knob: "uploadId", value: UPLOAD })).toBe(asPoster);
    });
  });

  it("changes nothing, dirty flag included, when the host picks what is already chosen", () => {
    expect(applyChange(DEFAULT_THEME, { knob: "font", value: "serif" })).toBe(DEFAULT_THEME);
    expect(applyChange(DEFAULT_THEME, { knob: "backgroundId", value: "golden" })).toBe(DEFAULT_THEME);
    expect(applyChange(DEFAULT_THEME, { knob: "accentOverride", value: null })).toBe(DEFAULT_THEME);
    const onUpload = applyChange(DEFAULT_THEME, { knob: "uploadId", value: UPLOAD });
    expect(applyChange(onUpload, { knob: "uploadId", value: UPLOAD })).toBe(onUpload);
  });

  it("keeps every other knob, the RSVP style included, when the layout changes and changes back", () => {
    const own = [
      { knob: "backgroundId", value: "dusk" },
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
      { knob: "backgroundId", value: "aurora" },
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

  it("accepts using the event's upload as the background or the poster, only when it has one", () => {
    expect(parseThemeChange({ knob: "uploadMode", value: "poster" }, UPLOAD)).toEqual({ knob: "uploadMode", value: "poster" });
    expect(parseThemeChange({ knob: "uploadMode", value: "background" }, UPLOAD)).toEqual({ knob: "uploadMode", value: "background" });
    expect(parseThemeChange({ knob: "uploadMode", value: "wallpaper" }, UPLOAD)).toBeUndefined();
    // An event without an upload has none to show.
    expect(parseThemeChange({ knob: "uploadMode", value: "poster" }, null)).toBeUndefined();
  });

  it("takes a new picture only from an upload, never from the drawer", () => {
    expect(parseThemeChange({ knob: "uploadId", value: UPLOAD }, UPLOAD)).toBeUndefined();
    expect(parseThemeChange({ knob: "uploadId", value: OTHER_UPLOAD }, UPLOAD)).toBeUndefined();
  });

  it("refuses anything else", () => {
    const refused: unknown[] = [
      null,
      "festival",
      { template: "zine" },
      { template: 7 },
      { knob: "backgroundId", value: "nope" },
      { knob: "backgroundId", value: null },
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
