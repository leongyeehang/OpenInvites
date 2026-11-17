import { describe, expect, it } from "vitest";
import { GALLERY_POSTERS } from "@/themes/posters";
import type { ThemeUpload } from "@/themes/resolve";
import { DEFAULT_THEME, type Theme } from "@/themes/theme";
import { homeTheme } from "./home";
import { areaLook, DBLESS_POOL, eventLook, hostLookOf, parseBackdropChoice, siteTheme, sitePoster, storedPick, type SiteArea } from "./site-look";

const AREAS: SiteArea[] = ["welcome", "guest", "fallback", "site", "host"];

// An event's theme that draws an effect on its own page, and the upload that is its poster.
const theme: Theme = { ...DEFAULT_THEME, poster: { kind: "upload" }, effect: "sparkles" };
const upload: ThemeUpload = {
  id: "0192f0a1-7b3c-7d4e-8f00-123456789abc",
  thumbnailSrc: "/uploads/0192f0a1-7b3c-7d4e-8f00-123456789abc/poster-720.webp",
  accent: "#3aa885",
  luminance: 0.2,
  lightest: "#303030",
  darkest: "#505050",
  altText: "",
  emoji: null,
  poster: {
    src: "/uploads/0192f0a1-7b3c-7d4e-8f00-123456789abc/poster.webp",
    srcSet: undefined,
    copySrc: "/uploads/0192f0a1-7b3c-7d4e-8f00-123456789abc/poster-copy.webp",
    width: 1200,
    height: 1800,
    lightest: "#202020",
    darkest: "#707070",
  },
};

describe("the pool drawn without the database", () => {
  it("is the whole gallery, in gallery order", () => {
    expect(DBLESS_POOL).toEqual(GALLERY_POSTERS.map((poster) => poster.id));
    expect(DBLESS_POOL).toHaveLength(20);
  });
});

describe("sitePoster", () => {
  it("gives each area a poster of its own from the whole gallery", () => {
    const posters = Object.fromEntries(AREAS.map((area) => [area, sitePoster(DBLESS_POOL, area)]));
    expect(posters).toEqual({ welcome: "bokeh", guest: "cocktails", fallback: "cake", site: "rose", host: "string-lights" });
    expect(new Set(Object.values(posters)).size).toBe(5);
  });

  it("draws from the site's set when the operator picked some", () => {
    const pool = ["disco", "balloons", "aurora"] as const;
    const posters = Object.fromEntries(AREAS.map((area) => [area, sitePoster(pool, area)]));
    expect(posters).toEqual({ welcome: "disco", guest: "disco", fallback: "balloons", site: "aurora", host: "aurora" });
  });

  it("falls back to the whole gallery when given an empty pool, rather than to no poster", () => {
    for (const area of AREAS) expect(sitePoster([], area), area).toBe(sitePoster(DBLESS_POOL, area));
  });

  it("gives every area the one poster of a pool of one, and the same poster on every visit", () => {
    for (const area of AREAS) expect(sitePoster(["seaside"], area), area).toBe("seaside");
    for (const area of AREAS) expect(sitePoster(DBLESS_POOL, area), area).toBe(sitePoster(DBLESS_POOL, area));
  });
});

describe("a site area's look", () => {
  it("is the poster's look as the home page wears it, with no upload", () => {
    expect(siteTheme("disco")).toEqual(homeTheme("disco"));
    expect(areaLook(DBLESS_POOL, "welcome")).toEqual({ theme: homeTheme("bokeh"), upload: null });
  });
});

describe("an event's management pages", () => {
  it("wear the event's theme and its upload, with no effect", () => {
    const look = eventLook(theme, upload);
    expect(look.theme).toEqual({ ...theme, effect: "none" });
    expect(look.upload).toBe(upload);
    // The event's own theme is left as it was: its page still draws the effect.
    expect(theme.effect).toBe("sparkles");
  });
});

describe("the host's own pages", () => {
  it("wear the host's pick first, over the glow of their next event", () => {
    expect(hostLookOf({ pick: "aurora", glow: eventLook(theme, upload), pool: DBLESS_POOL })).toEqual({ theme: siteTheme("aurora"), upload: null });
  });

  it("wear their next event's look when they picked none", () => {
    const glow = eventLook(theme, upload);
    expect(hostLookOf({ pick: null, glow, pool: DBLESS_POOL })).toBe(glow);
  });

  it("wear the host area's poster from the site's set with neither", () => {
    const look = hostLookOf({ pick: null, glow: null, pool: DBLESS_POOL });
    expect(look).toEqual(areaLook(DBLESS_POOL, "host"));
    expect(look.theme).toEqual(homeTheme("string-lights"));
  });
});

describe("the host's Backdrop choice", () => {
  it("reads Automatic as no pick, and a gallery poster as itself", () => {
    expect(parseBackdropChoice("auto")).toEqual({ ok: true, poster: null });
    expect(parseBackdropChoice("disco")).toEqual({ ok: true, poster: "disco" });
  });

  it("refuses anything else: a poster's file name, nothing, and Automatic in another case", () => {
    for (const value of ["disco-ball", "", "AUTO"]) expect(parseBackdropChoice(value), value).toEqual({ ok: false });
  });
});

describe("a stored pick", () => {
  it("is no pick when none is stored, and the poster when it is in the gallery", () => {
    expect(storedPick(null)).toBeNull();
    expect(storedPick("aurora")).toBe("aurora");
  });

  it("reads as Automatic when its poster has left the gallery", () => {
    expect(storedPick("retired-poster")).toBeNull();
  });
});
