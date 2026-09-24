import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import { findBackground } from "../backgrounds";
import { SWATCHES } from "../swatches";
import { BUTTON_STYLES, EFFECTS, FONTS, LAYOUTS, RSVP_STYLES, TEXT_TONES, TITLE_PLACEMENTS } from "../theme";
import { findTemplate, TEMPLATES } from ".";

// Templates are data contributors edit; these checks catch a slip before it reaches a page.
describe("templates", () => {
  it("ships the six, in the drawer's order, each with a unique id", () => {
    expect(TEMPLATES.map((template) => template.id)).toEqual(["birthday", "vows", "supper", "kids", "festival", "quiet"]);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(6);
  });

  it("names each in English, with a line about its look, and names nothing else", () => {
    const ids = TEMPLATES.map((template) => template.id).sort();
    expect(Object.keys(en.DesignDrawer.templateNames).sort()).toEqual(ids);
    expect(Object.keys(en.DesignDrawer.templateBlurbs).sort()).toEqual(ids);
    for (const id of ids) expect(en.DesignDrawer.templateBlurbs[id].length, id).toBeGreaterThan(0);
  });

  it("sets every knob of the theme to a value the Design drawer can show", () => {
    for (const { id, theme } of TEMPLATES) {
      expect(Object.keys(theme).sort(), id).toEqual(
        ["accentOverride", "backgroundId", "buttonStyle", "effect", "font", "layout", "rsvpStyle", "textTone", "titlePlacement"],
      );
      expect(LAYOUTS, id).toContain(theme.layout);
      expect(findBackground(theme.backgroundId), id).toBeDefined();
      expect(FONTS, id).toContain(theme.font);
      // Auto or one of the six swatches, so the accent row always shows which is chosen.
      expect([null, ...SWATCHES.map((swatch) => swatch.hex)], id).toContain(theme.accentOverride);
      expect(TEXT_TONES, id).toContain(theme.textTone);
      expect(BUTTON_STYLES, id).toContain(theme.buttonStyle);
      expect(RSVP_STYLES, id).toContain(theme.rsvpStyle);
      expect(EFFECTS, id).toContain(theme.effect);
      expect(TITLE_PLACEMENTS, id).toContain(theme.titlePlacement);
    }
  });

  it("makes Birthday round one's A and Festival round one's B (PROTOTYPE.md)", () => {
    expect(findTemplate("birthday")?.theme).toMatchObject({
      layout: "poster",
      backgroundId: "golden",
      font: "serif",
      accentOverride: null,
      buttonStyle: "glass",
      rsvpStyle: "sheet",
      effect: "sparkles",
    });
    expect(findTemplate("festival")?.theme).toMatchObject({
      layout: "poster",
      backgroundId: "aurora",
      font: "grotesque",
      accentOverride: null,
      buttonStyle: "glass",
      rsvpStyle: "inline",
      effect: "doodles",
    });
  });

  it("lets Supper club and Kids' party name the layouts they were made for", () => {
    expect(findTemplate("supper")?.theme.layout).toBe("broadsheet");
    expect(findTemplate("kids")?.theme.layout).toBe("thread");
  });

  it("finds a template by id and nothing for an unknown one", () => {
    expect(findTemplate("vows")?.theme.backgroundId).toBe("rose");
    expect(findTemplate("zine")).toBeUndefined();
  });
});
