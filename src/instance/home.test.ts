import { describe, expect, it } from "vitest";
import { GALLERY_POSTERS } from "@/themes/posters";
import { DEFAULT_HOME_PAGE, DEFAULT_INSTANCE_NAME, instanceDisplayName, normaliseText, parseHomePage, posterPool, type HomePage } from "./home";

const fields = (over: Partial<Parameters<typeof parseHomePage>[0]> = {}) => ({
  instanceName: "",
  welcomeLine: "",
  posters: "all",
  posterIds: [] as string[],
  showOperator: false,
  ...over,
});

const ALL = GALLERY_POSTERS.map((poster) => poster.id);

describe("normaliseText", () => {
  it("trims and folds every run of whitespace, line breaks included, into one space", () => {
    expect(normaliseText("  Ada  and\n\n Bo\t house ")).toBe("Ada and Bo house");
  });

  it("turns nothing, or only whitespace, into null", () => {
    expect(normaliseText("")).toBeNull();
    expect(normaliseText(" \n\t ")).toBeNull();
  });
});

describe("parseHomePage", () => {
  it("reads the defaults from an empty form", () => {
    expect(parseHomePage(fields())).toEqual({ ok: true, page: DEFAULT_HOME_PAGE });
  });

  it("accepts a name of 40 characters and refuses 41", () => {
    expect(parseHomePage(fields({ instanceName: "a".repeat(40) }))).toMatchObject({ ok: true });
    expect(parseHomePage(fields({ instanceName: "a".repeat(41) }))).toEqual({ ok: false, field: "instanceName", reason: "tooLong" });
  });

  it("accepts a welcome line of 140 characters and refuses 141", () => {
    expect(parseHomePage(fields({ welcomeLine: "a".repeat(140) }))).toMatchObject({ ok: true });
    expect(parseHomePage(fields({ welcomeLine: "a".repeat(141) }))).toEqual({ ok: false, field: "welcomeLine", reason: "tooLong" });
  });

  it("counts code points, so 40 Chinese characters fit", () => {
    expect(parseHomePage(fields({ instanceName: "邀".repeat(40) }))).toMatchObject({ ok: true });
    expect(parseHomePage(fields({ instanceName: "😀".repeat(40) }))).toMatchObject({ ok: true });
    expect(parseHomePage(fields({ instanceName: "邀".repeat(41) }))).toMatchObject({ ok: false });
  });

  it("measures the name after it is normalised", () => {
    const result = parseHomePage(fields({ instanceName: `  ${"a".repeat(40)}  \n`, welcomeLine: "  hello   there " }));
    expect(result).toMatchObject({ ok: true, page: { instanceName: "a".repeat(40), welcomeLine: "hello there" } });
  });

  it("asks for at least one poster when picking", () => {
    expect(parseHomePage(fields({ posters: "picked" }))).toEqual({ ok: false, field: "posters", reason: "noneChosen" });
    expect(parseHomePage(fields({ posters: "picked", posterIds: ["disco", "cake"] }))).toMatchObject({ ok: true, page: { posters: "picked", posterIds: ["disco", "cake"] } });
  });

  it("asks for exactly one poster for one", () => {
    expect(parseHomePage(fields({ posters: "one" }))).toEqual({ ok: false, field: "posters", reason: "chooseOne" });
    expect(parseHomePage(fields({ posters: "one", posterIds: ["disco", "cake"] }))).toEqual({ ok: false, field: "posters", reason: "chooseOne" });
    expect(parseHomePage(fields({ posters: "one", posterIds: ["disco"] }))).toMatchObject({ ok: true, page: { posters: "one", posterIds: ["disco"] } });
  });

  it("refuses an id that is not in the gallery, and a mode that is not one", () => {
    expect(parseHomePage(fields({ posters: "picked", posterIds: ["disco", "nope"] }))).toEqual({ ok: false, field: "posters", reason: "unknownPoster" });
    expect(parseHomePage(fields({ posters: "some" }))).toEqual({ ok: false, field: "posters", reason: "unknownPoster" });
  });

  it("stores no ids with all", () => {
    expect(parseHomePage(fields({ posters: "all", posterIds: ["disco"] }))).toMatchObject({ ok: true, page: { posters: "all", posterIds: [] } });
  });

  it("keeps the show-operator choice", () => {
    expect(parseHomePage(fields({ showOperator: true }))).toMatchObject({ ok: true, page: { showOperator: true } });
  });
});

describe("posterPool", () => {
  const page = (posters: HomePage["posters"], posterIds: string[]) => ({ posters, posterIds: posterIds as HomePage["posterIds"] });

  it("is the whole gallery for all", () => {
    expect(posterPool(page("all", ["disco"]))).toEqual(ALL);
  });

  it("is the picked ids in gallery order", () => {
    const [first, second] = ALL;
    expect(posterPool(page("picked", [second, first]))).toEqual([first, second]);
  });

  it("is the one poster", () => {
    expect(posterPool(page("one", ["disco"]))).toEqual(["disco"]);
  });

  it("skips an id no longer in the gallery", () => {
    expect(posterPool(page("picked", ["gone", "disco"]))).toEqual(["disco"]);
  });

  it("falls back to the whole gallery when every id is unknown, or none is stored", () => {
    expect(posterPool(page("picked", ["gone"]))).toEqual(ALL);
    expect(posterPool(page("one", []))).toEqual(ALL);
  });
});

describe("instanceDisplayName", () => {
  it("is the name, or OpenInvites without one", () => {
    expect(instanceDisplayName({ instanceName: "Ada's place" })).toBe("Ada's place");
    expect(instanceDisplayName({ instanceName: null })).toBe(DEFAULT_INSTANCE_NAME);
    expect(DEFAULT_INSTANCE_NAME).toBe("OpenInvites");
  });
});
