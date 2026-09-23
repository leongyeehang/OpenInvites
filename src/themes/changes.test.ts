import { describe, expect, it } from "vitest";
import { applyChange, parseThemeChange, themeReadout, type ThemeChange } from "./changes";
import { findTemplate } from "./templates";
import { applyTemplate, DEFAULT_THEME, type Theme } from "./theme";

const template = (id: string) => findTemplate(id)!;
const withUpload: Theme = { ...DEFAULT_THEME, backgroundId: null, uploadId: "0192f0a1-7b3c-7d4e-8f00-123456789abc", uploadMode: "poster" };

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
      rsvpStyle: "inline",
      effect: "sparkles",
      template: { id: "vows", dirty: false },
    });
  });

  it("keeps the host's upload in their gallery while showing the template's background", () => {
    const applied = applyTemplate(withUpload, template("quiet"));
    expect(applied).toMatchObject({ backgroundId: "slate", uploadId: withUpload.uploadId, uploadMode: "poster" });
  });

  it("applies Supper club and Kids' party with the Poster layout while theirs are coming", () => {
    expect(applyTemplate(DEFAULT_THEME, template("supper")).layout).toBe("poster");
    expect(applyTemplate(DEFAULT_THEME, template("kids")).layout).toBe("poster");
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

  it("changes nothing, dirty flag included, when the host picks what is already chosen", () => {
    expect(applyChange(DEFAULT_THEME, { knob: "font", value: "serif" })).toBe(DEFAULT_THEME);
    expect(applyChange(DEFAULT_THEME, { knob: "backgroundId", value: "golden" })).toBe(DEFAULT_THEME);
    expect(applyChange(DEFAULT_THEME, { knob: "accentOverride", value: null })).toBe(DEFAULT_THEME);
  });

  it("leaves a theme that started from no template without one", () => {
    const own: Theme = { ...DEFAULT_THEME, template: null };
    expect(applyChange(own, { knob: "font", value: "rounded" }).template).toBeNull();
  });
});

describe("the theme readout", () => {
  it("names the template while nothing has changed", () => {
    expect(themeReadout(DEFAULT_THEME)).toEqual({ custom: false, template: "Birthday" });
  });

  it("says custom, started from the template, once a knob has changed", () => {
    expect(themeReadout(applyChange(DEFAULT_THEME, { knob: "buttonStyle", value: "solid" }))).toEqual({ custom: true, template: "Birthday" });
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
    ];
    for (const change of offered) expect(parseThemeChange(JSON.parse(JSON.stringify(change)))).toEqual(change);
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
      { knob: "layout", value: "broadsheet" },
      { knob: "uploadId", value: "0192f0a1-7b3c-7d4e-8f00-123456789abc" },
      { knob: "template", value: { id: "birthday", dirty: false } },
    ];
    for (const change of refused) expect(parseThemeChange(change), JSON.stringify(change)).toBeUndefined();
  });
});
