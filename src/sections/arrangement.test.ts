import { describe, expect, it } from "vitest";
import type { RichText } from "@/rich-text/rich-text";
import {
  applyArrangementChange,
  defaultOrder,
  linkHost,
  parseArrangement,
  parseArrangementChange,
  placedSections,
  safeLinkUrl,
  sectionId,
  sectionKey,
  sectionOn,
  sheetRows,
  switchesAfter,
  type Arrangement,
  type ArrangementChange,
  type BuiltInKind,
  type Section,
  type Shown,
  type Switches,
} from "./arrangement";
import { REGISTRY } from "./registry";

const keys = (sections: Section[]) => sections.map(sectionKey);
const POSTER = ["letter", "details", "schedule", "guests", "announcements", "comments", "album", "countdown"];
const BROADSHEET = ["letter", "details", "schedule", "announcements", "guests", "comments", "album", "countdown"];

const EVERYTHING: Partial<Record<BuiltInKind, Shown>> = {
  letter: { count: null },
  details: { count: null },
  schedule: { count: 2 },
  guests: { count: 4 },
  announcements: { count: 1 },
  comments: { count: 3 },
  album: { count: 9 },
  countdown: { count: null },
};

// Everything shown but one kind, as when this viewer gets nothing of it.
const except = (kind: BuiltInKind) => Object.fromEntries(Object.entries(EVERYTHING).filter(([each]) => each !== kind));

const body = (text: string): RichText => ({ blocks: [{ type: "paragraph", spans: [{ text }] }] });
const note = (id: string, extra: Partial<Section & { kind: "note" }> = {}): Section => ({
  kind: "note",
  id,
  on: true,
  collapsed: false,
  heading: null,
  body: body("Dress code: sparkly"),
  ...extra,
});
const links = (id: string, extra: Partial<Section & { kind: "links" }> = {}): Section => ({
  kind: "links",
  id,
  on: true,
  collapsed: false,
  heading: null,
  links: [{ label: "Registry", url: "https://example.com/registry" }],
  ...extra,
});

// An arrangement as stored: the Poster's default with the given sections changed or added.
const arranged = (change: (sections: Section[]) => Section[] = (sections) => sections): Arrangement => ({ sections: change(defaultOrder("poster")) });

const SWITCHES: Switches = { lettersEnabled: true, commentsEnabled: true, guestListVisibility: "afterReply", albumEnabled: true };

const parsed = (posted: unknown) => parseArrangementChange(posted, () => "made0001");
const change = (posted: unknown): ArrangementChange => {
  const result = parsed(posted);
  if (!result.ok) throw new Error(`refused: ${result.error}`);
  return result.change;
};
const applied = (arrangement: Arrangement, posted: unknown) => applyArrangementChange(arrangement, "poster", change(posted));
const appliedKeys = (arrangement: Arrangement, posted: unknown) => {
  const result = applied(arrangement, posted);
  if (!result.ok) throw new Error(`refused: ${result.error}`);
  return keys(result.arrangement.sections);
};

describe("each layout's default order", () => {
  it("is today's order, with the countdown last", () => {
    expect(keys(defaultOrder("poster"))).toEqual(POSTER);
    expect(keys(defaultOrder("thread"))).toEqual(POSTER);
    expect(keys(defaultOrder("broadsheet"))).toEqual(BROADSHEET);
  });

  it("collapses only the Thread's comments, leaves the countdown off and the rest on, in each kind's first style", () => {
    for (const layout of ["poster", "broadsheet", "thread"] as const) {
      for (const section of defaultOrder(layout)) {
        expect(section.collapsed, `${layout} ${section.kind}`).toBe(layout === "thread" && section.kind === "comments");
        expect(section.heading).toBeNull();
      }
      const byKind = Object.fromEntries(defaultOrder(layout).map((section) => [section.kind, section]));
      expect(byKind.countdown).toMatchObject({ on: false });
      expect(byKind.schedule).toMatchObject({ on: true });
      expect(byKind.announcements).toMatchObject({ on: true });
      expect(byKind.album).toMatchObject({ style: "grid" });
      expect(byKind.comments).toMatchObject({ style: "list" });
      expect(byKind.guests).toMatchObject({ style: "names" });
      // The registry says which style is first; the default reads it there (ticket 25).
      for (const kind of ["album", "comments", "guests"] as const) expect(byKind[kind]).toMatchObject({ style: REGISTRY[kind].styles[0] });
      expect("on" in byKind.letter || "style" in byKind.letter).toBe(false);
    }
  });
});

describe("placedSections", () => {
  it("places a page never arranged in today's order, the countdown being off", () => {
    const placed = placedSections(null, "poster", EVERYTHING);
    expect(placed.map((each) => each.key)).toEqual(POSTER.slice(0, 7));
    expect(placed.map((each) => each.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(placedSections(null, "broadsheet", EVERYTHING).map((each) => each.key)).toEqual(BROADSHEET.slice(0, 7));
  });

  it("counts the index over the full order, so a section keeps its place when one before it is not shown", () => {
    const placed = placedSections(null, "poster", except("letter"));
    expect(placed[0]).toMatchObject({ key: "details", index: 1 });
  });

  it("collapses the Thread's comments, unless they are locked to this viewer", () => {
    const comments = (shown: Shown) => placedSections(null, "thread", { ...EVERYTHING, comments: shown }).find((each) => each.kind === "comments");
    expect(comments({ count: 3 })).toMatchObject({ collapsed: true, count: 3 });
    expect(comments({ count: 3, locked: true })).toMatchObject({ collapsed: false });
  });

  it("leaves out a kind not shown, a section switched off, and the countdown unless it is on and shown", () => {
    expect(placedSections(null, "poster", except("album")).map((each) => each.key)).not.toContain("album");

    const scheduleOff = arranged((sections) => sections.map((each) => (each.kind === "schedule" ? { ...each, on: false } : each)));
    expect(placedSections(scheduleOff, "poster", EVERYTHING).map((each) => each.key)).not.toContain("schedule");

    const countdownOn = arranged((sections) => sections.map((each) => (each.kind === "countdown" ? { ...each, on: true } : each)));
    expect(placedSections(countdownOn, "poster", EVERYTHING).map((each) => each.key)).toContain("countdown");
    expect(placedSections(countdownOn, "poster", except("countdown")).map((each) => each.key)).not.toContain("countdown");
  });

  it("places a Note and Links with something in them, counting the links", () => {
    const withCustom = arranged((sections) => [
      ...sections,
      note("aaaaaaaa"),
      note("bbbbbbbb", { body: { blocks: [] } }),
      links("cccccccc", { links: [{ label: "A", url: "https://a.example/" }, { label: "", url: "https://b.example/" }] }),
      links("dddddddd", { links: [] }),
      note("eeeeeeee", { on: false }),
    ]);
    const placed = placedSections(withCustom, "poster", EVERYTHING);
    expect(placed.map((each) => each.key)).toEqual([...POSTER.slice(0, 7), "note:aaaaaaaa", "links:cccccccc"]);
    expect(placed.find((each) => each.kind === "note")).toMatchObject({ count: null, index: 8, style: null });
    expect(placed.find((each) => each.kind === "links")).toMatchObject({ count: 2, index: 10 });
  });

  it("carries a heading and a style through as stored, and the section itself", () => {
    const styled = arranged((sections) => sections.map((each) => (each.kind === "album" ? { ...each, heading: "Our pictures", style: "mosaic" as const } : each)));
    const album = placedSections(styled, "poster", EVERYTHING).find((each) => each.kind === "album");
    expect(album).toMatchObject({ heading: "Our pictures", style: "mosaic", count: 9, collapsed: false });
    expect(album?.section).toMatchObject({ kind: "album", style: "mosaic" });
  });
});

describe("parseArrangement", () => {
  it("reads anything that is not a stored arrangement as never arranged", () => {
    for (const stored of [{}, null, "x", { sections: "x" }, undefined, 42]) expect(parseArrangement(stored)).toBeNull();
  });

  it("drops kinds it does not know, entries that are not sections and repeats, keeping the first", () => {
    const stored = {
      sections: [
        { kind: "album", collapsed: true, heading: null, style: "strip" },
        "nonsense",
        null,
        { kind: "map" },
        { kind: "album", collapsed: false, heading: "Second", style: "grid" },
        { kind: "note", id: "abcd1234", on: true, collapsed: false, heading: null, body: body("First") },
        { kind: "note", id: "abcd1234", on: true, collapsed: false, heading: null, body: body("Second") },
        { kind: "note", id: "ABCD1234", on: true, collapsed: false, heading: null, body: body("Shouting") },
        { kind: "note", id: "abc", on: true, collapsed: false, heading: null, body: body("Short") },
        { kind: "links", on: true, collapsed: false, heading: null, links: [] },
      ],
    };
    const sections = parseArrangement(stored)!.sections;
    expect(sections.filter((each) => each.kind === "album")).toEqual([{ kind: "album", collapsed: true, heading: null, style: "strip" }]);
    expect(sections.filter((each) => each.kind === "note")).toEqual([note("abcd1234", { body: body("First") })]);
    expect(sections.filter((each) => each.kind === "links")).toEqual([]);
  });

  it("puts back a built-in section missing from the stored order after the one before it in the Poster's order", () => {
    const stored = { sections: defaultOrder("poster").filter((each) => each.kind !== "countdown" && each.kind !== "schedule").reverse() };
    const sections = parseArrangement(stored)!.sections;
    // Reversed: album, comments, announcements, guests, details, letter. Schedule follows details;
    // countdown follows album.
    expect(keys(sections)).toEqual(["album", "countdown", "comments", "announcements", "guests", "details", "schedule", "letter"]);
    expect(sections.find((each) => each.kind === "countdown")).toEqual({ kind: "countdown", on: false, collapsed: false, heading: null });
    expect(keys(parseArrangement({ sections: [] })!.sections)).toEqual(POSTER);
  });

  it("tidies a heading: whitespace collapsed, clipped to 40, empty as none, and none on the Letter and Details", () => {
    const stored = {
      sections: [
        { kind: "schedule", on: true, collapsed: false, heading: "  The   plan\n for the day  " },
        { kind: "announcements", on: true, collapsed: false, heading: "x".repeat(50) },
        { kind: "album", collapsed: false, heading: "   ", style: "grid" },
        { kind: "letter", collapsed: false, heading: "Dear you" },
        { kind: "details", collapsed: false, heading: "The facts" },
        { kind: "comments", collapsed: false, heading: 42, style: "list" },
      ],
    };
    const byKind = Object.fromEntries(parseArrangement(stored)!.sections.map((each) => [each.kind, each.heading]));
    expect(byKind).toMatchObject({ schedule: "The plan for the day", announcements: "x".repeat(40), album: null, letter: null, details: null, comments: null });
  });

  it("collapses only what may be, and gives a style the kind does not have its first", () => {
    const stored = {
      sections: [
        { kind: "letter", collapsed: true, heading: null },
        { kind: "countdown", on: true, collapsed: true, heading: null },
        { kind: "guests", collapsed: true, heading: null, style: "avatars" },
        { kind: "album", collapsed: false, heading: null, style: "bubbles" },
        { kind: "comments", collapsed: "yes", heading: null },
      ],
    };
    const byKind = Object.fromEntries(parseArrangement(stored)!.sections.map((each) => [each.kind, each]));
    expect(byKind.letter.collapsed).toBe(false);
    expect(byKind.countdown).toEqual({ kind: "countdown", on: true, collapsed: false, heading: null });
    expect(byKind.guests).toMatchObject({ collapsed: true, style: "avatars" });
    expect(byKind.album).toMatchObject({ style: "grid" });
    expect(byKind.comments).toMatchObject({ collapsed: false, style: "list" });
  });

  it("clips a Note to 2,000 characters, keeps 6 links and 10 written sections, and drops a link it would not follow", () => {
    const long = { blocks: [{ type: "paragraph", spans: [{ text: "x".repeat(2_500) }] }] };
    const sevenLinks = Array.from({ length: 7 }, (_, n) => ({ label: `Link ${n}`, url: `https://example.com/${n}` }));
    const stored = {
      sections: [
        { kind: "note", id: "aaaaaaaa", on: true, collapsed: false, heading: null, body: long },
        {
          kind: "links",
          id: "bbbbbbbb",
          on: true,
          collapsed: false,
          heading: null,
          links: [{ label: "Bad", url: "javascript:alert(1)" }, { label: "y".repeat(50), url: "example.com/registry" }, "nonsense", ...sevenLinks],
        },
        ...Array.from({ length: 10 }, (_, n) => ({ kind: "note", id: `cccccc${n}0`, on: true, collapsed: false, heading: null, body: body(`${n}`) })),
      ],
    };
    const sections = parseArrangement(stored)!.sections;
    const first = sections.find((each) => each.kind === "note")!;
    expect(first.kind === "note" && first.body).toEqual({ blocks: [{ type: "paragraph", spans: [{ text: "x".repeat(2_000) }] }] });
    const block = sections.find((each) => each.kind === "links")!;
    expect(block.kind === "links" && block.links).toEqual([
      { label: "y".repeat(40), url: "https://example.com/registry" },
      ...sevenLinks.slice(0, 5).map((link) => ({ ...link, url: `${link.url}` })),
    ]);
    // The first ten written sections in the stored order: the Note, the Links, then eight of the ten
    // Notes after them.
    expect(keys(sections.filter((each) => each.kind === "note" || each.kind === "links"))).toEqual([
      "note:aaaaaaaa",
      "links:bbbbbbbb",
      ...Array.from({ length: 8 }, (_, n) => `note:cccccc${n}0`),
    ]);
  });

  // Ticket 25: what is past a limit is not read at all, so a stored value padded with thousands of
  // links or sections costs no more to read than one at the limit.
  it("stops reading a Links section's links at six kept, and written sections at ten kept", () => {
    const read: string[] = [];
    const watched = (name: string, value: object) => new Proxy(value, { get: (target, field) => (read.push(`${name}.${String(field)}`), Reflect.get(target, field)) });
    const linksRead = Array.from({ length: 8 }, (_, n) => watched(`link${n}`, { label: `Link ${n}`, url: `https://example.com/${n}` }));
    const notes = Array.from({ length: 11 }, (_, n) => watched(`note${n}`, { kind: "note", id: `dddddd${n}0`, on: true, collapsed: false, heading: null, body: body(`${n}`) }));
    const sections = parseArrangement({ sections: [{ kind: "links", id: "bbbbbbbb", on: true, collapsed: false, heading: null, links: linksRead }, ...notes] })!.sections;
    const block = sections.find((each) => each.kind === "links")!;
    expect(block.kind === "links" && block.links).toHaveLength(6);
    expect(read.filter((each) => each.startsWith("link6.") || each.startsWith("link7."))).toEqual([]);
    expect(sections.filter((each) => each.kind === "note")).toHaveLength(9);
    // Only its kind is read, which says it is a written section and so past the limit.
    expect(read.filter((each) => /^note(9|10)\./.test(each) && each !== "note9.kind" && each !== "note10.kind")).toEqual([]);
  });
});

describe("links a guest may follow", () => {
  it("takes http and https, and assumes https for an address typed without a scheme", () => {
    expect(safeLinkUrl("https://a.example/x")).toBe("https://a.example/x");
    expect(safeLinkUrl("http://a.example/x?y=1")).toBe("http://a.example/x?y=1");
    expect(safeLinkUrl("  https://a.example/x  ")).toBe("https://a.example/x");
    expect(safeLinkUrl("example.com/registry")).toBe("https://example.com/registry");
    expect(safeLinkUrl("localhost:3000/list")).toBe("https://localhost:3000/list");
  });

  it("refuses any other scheme, an address over 2,000 characters, and what is not an address", () => {
    for (const value of ["mailto:ada@example.com", "javascript:alert(1)", "JavaScript:alert(1)", "ftp://example.com/file", "data:text/html,x"]) {
      expect(safeLinkUrl(value), value).toBeUndefined();
    }
    expect(safeLinkUrl(`https://example.com/${"x".repeat(2_000)}`)).toBeUndefined();
    expect(safeLinkUrl(`https://example.com/${"x".repeat(1_980)}`)).toBeDefined();
    for (const value of ["", "   ", 42, null, "https://", "not an address at all"]) expect(safeLinkUrl(value), String(value)).toBeUndefined();
  });

  // Ticket 25: an address with a name or password before its host reads as the name's site to a
  // person and goes to the host's.
  it("refuses an address that carries a name or a password", () => {
    for (const value of ["https://bank.example@evil.example/", "https://ada:secret@example.com/list", "http://:pw@example.com/", "bank.example@evil.example"]) {
      expect(safeLinkUrl(value), value).toBeUndefined();
    }
  });

  it("names a link's site without its www", () => {
    expect(linkHost("https://www.example.com/list?a=1")).toBe("example.com");
    expect(linkHost("https://registry.example.org/")).toBe("registry.example.org");
  });
});

describe("parseArrangementChange", () => {
  it("refuses what is not a change it knows", () => {
    for (const posted of [null, "move", 42, [], { type: "explode", key: "album" }, { type: "move", key: "album" }, { type: "toggle", key: "album", on: "yes" }, { type: "style", key: "album", style: "pretty" }, { type: "audience", visibility: "hidden" }]) {
      expect(parsed(posted), JSON.stringify(posted)).toEqual({ ok: false, error: "unreadable" });
    }
  });

  it("reads each change", () => {
    expect(parsed({ type: "move", key: "album", past: "comments" })).toEqual({ ok: true, change: { type: "move", key: "album", past: "comments" } });
    expect(parsed({ type: "toggle", key: "schedule", on: false })).toEqual({ ok: true, change: { type: "toggle", key: "schedule", on: false } });
    expect(parsed({ type: "collapse", key: "album", collapsed: true })).toEqual({ ok: true, change: { type: "collapse", key: "album", collapsed: true } });
    expect(parsed({ type: "style", key: "album", style: "strip" })).toEqual({ ok: true, change: { type: "style", key: "album", style: "strip" } });
    expect(parsed({ type: "audience", visibility: "always" })).toEqual({ ok: true, change: { type: "audience", visibility: "always" } });
    expect(parsed({ type: "remove", key: "note:abcd1234" })).toEqual({ ok: true, change: { type: "remove", key: "note:abcd1234" } });
    expect(parsed({ type: "addLinks", after: null, heading: "Registry" })).toEqual({
      ok: true,
      change: { type: "addLinks", id: "made0001", after: null, heading: "Registry" },
    });
  });

  it("trims a heading, reads one of only spaces as none, and refuses one over 40 characters", () => {
    expect(parsed({ type: "rename", key: "album", heading: "  Our   pictures " })).toEqual({ ok: true, change: { type: "rename", key: "album", heading: "Our pictures" } });
    expect(parsed({ type: "rename", key: "album", heading: "    " })).toEqual({ ok: true, change: { type: "rename", key: "album", heading: null } });
    expect(parsed({ type: "rename", key: "album", heading: null })).toEqual({ ok: true, change: { type: "rename", key: "album", heading: null } });
    expect(parsed({ type: "rename", key: "album", heading: "x".repeat(41) })).toEqual({ ok: false, error: "headingTooLong" });
    expect(parsed({ type: "addNote", after: null, heading: "x".repeat(41) })).toEqual({ ok: false, error: "headingTooLong" });
  });

  // Ticket 25: a heading that is not words at all is unreadable, not too long.
  it("refuses a heading that is neither words nor none as unreadable", () => {
    for (const heading of [42, true, {}, ["x"]]) {
      expect(parsed({ type: "rename", key: "album", heading }), JSON.stringify(heading)).toEqual({ ok: false, error: "unreadable" });
      expect(parsed({ type: "addNote", after: null, heading }), JSON.stringify(heading)).toEqual({ ok: false, error: "unreadable" });
    }
  });

  it("counts a heading by character, so 40 Chinese characters or 40 emoji fit and a 41st does not", () => {
    for (const character of ["字", "🎉"]) {
      expect(parsed({ type: "rename", key: "album", heading: character.repeat(40) })).toEqual({ ok: true, change: { type: "rename", key: "album", heading: character.repeat(40) } });
      expect(parsed({ type: "rename", key: "album", heading: character.repeat(41) })).toEqual({ ok: false, error: "headingTooLong" });
    }
  });

  it("uses the id it makes for a new section, never one posted", () => {
    expect(parsed({ type: "addNote", id: "chosen99", after: "comments", heading: null })).toEqual({
      ok: true,
      change: { type: "addNote", id: "made0001", after: "comments", heading: null },
    });
  });

  it("holds a Note to 2,000 characters", () => {
    const of = (length: number) => ({ blocks: [{ type: "paragraph", spans: [{ text: "x".repeat(length) }] }] });
    expect(parsed({ type: "editNote", key: "note:abcd1234", body: of(2_000) })).toEqual({ ok: true, change: { type: "editNote", key: "note:abcd1234", body: of(2_000) } });
    expect(parsed({ type: "editNote", key: "note:abcd1234", body: of(2_001) })).toEqual({ ok: false, error: "noteTooLong" });
  });

  it("holds Links to six, a label to 40 characters, and an address to one a guest may follow", () => {
    const edit = (links: unknown) => parsed({ type: "editLinks", key: "links:abcd1234", links });
    const link = (label: string, url: string) => ({ label, url });
    expect(edit([link("  Registry ", "example.com/registry"), link("", "https://b.example/")])).toEqual({
      ok: true,
      change: { type: "editLinks", key: "links:abcd1234", links: [link("Registry", "https://example.com/registry"), link("", "https://b.example/")] },
    });
    expect(edit(Array.from({ length: 7 }, () => link("A", "https://a.example/")))).toEqual({ ok: false, error: "tooManyLinks" });
    expect(edit([link("x".repeat(41), "https://a.example/")])).toEqual({ ok: false, error: "labelTooLong" });
    expect(edit([link("A", `https://a.example/${"x".repeat(2_000)}`)])).toEqual({ ok: false, error: "urlTooLong" });
    expect(edit([link("A", "javascript:alert(1)")])).toEqual({ ok: false, error: "urlInvalid" });
    expect(edit("nonsense")).toEqual({ ok: false, error: "unreadable" });
  });
});

describe("applyArrangementChange", () => {
  it("moves a section past the neighbour named, starting from the layout's default", () => {
    expect(appliedKeys(null, { type: "move", key: "album", past: "comments" })).toEqual([
      "letter",
      "details",
      "schedule",
      "guests",
      "announcements",
      "album",
      "comments",
      "countdown",
    ]);
    expect(appliedKeys(null, { type: "move", key: "comments", past: "countdown" })).toEqual([
      "letter",
      "details",
      "schedule",
      "guests",
      "announcements",
      "album",
      "countdown",
      "comments",
    ]);
  });

  it("still moves past a neighbour that another host has moved meanwhile, keeping every section", () => {
    // The sheet showed album just below comments; meanwhile comments went to the top.
    const meanwhile = arranged((sections) => [sections[5], ...sections.filter((each) => each.kind !== "comments")]);
    const after = appliedKeys(meanwhile, { type: "move", key: "album", past: "comments" });
    expect(after.indexOf("album")).toBeLessThan(after.indexOf("comments"));
    expect([...after].sort()).toEqual([...keys(meanwhile!.sections)].sort());
  });

  it("refuses a section, or a neighbour, that is not on the page", () => {
    expect(applied(null, { type: "move", key: "map", past: "comments" })).toEqual({ ok: false, error: "unknownSection" });
    expect(applied(null, { type: "move", key: "album", past: "note:abcd1234" })).toEqual({ ok: false, error: "unknownSection" });
    // Another host removed the note this one is editing.
    expect(applied(null, { type: "editNote", key: "note:abcd1234", body: body("Hello") })).toEqual({ ok: false, error: "unknownSection" });
    expect(applied(null, { type: "remove", key: "links:abcd1234" })).toEqual({ ok: false, error: "unknownSection" });
  });

  it("switches a section whose switch is the arrangement's, refuses Details, and leaves a column's to the column", () => {
    const result = applied(null, { type: "toggle", key: "schedule", on: false });
    expect(result.ok && result.arrangement.sections.find((each) => each.kind === "schedule")).toMatchObject({ on: false });
    expect(applied(null, { type: "toggle", key: "details", on: false })).toEqual({ ok: false, error: "notOffered" });
    expect(applied(null, { type: "toggle", key: "comments", on: false })).toEqual({ ok: true, arrangement: { sections: defaultOrder("poster") } });
  });

  it("refuses what a kind does not offer", () => {
    expect(applied(null, { type: "collapse", key: "letter", collapsed: true })).toEqual({ ok: false, error: "notOffered" });
    expect(applied(null, { type: "rename", key: "details", heading: "Facts" })).toEqual({ ok: false, error: "notOffered" });
    expect(applied(null, { type: "style", key: "album", style: "bubbles" })).toEqual({ ok: false, error: "notOffered" });
    expect(applied(null, { type: "remove", key: "album" })).toEqual({ ok: false, error: "notOffered" });
  });

  it("collapses, renames and styles a section", () => {
    const steps: unknown[] = [
      { type: "collapse", key: "album", collapsed: true },
      { type: "rename", key: "album", heading: "Our pictures" },
      { type: "style", key: "album", style: "strip" },
    ];
    let arrangement: Arrangement = null;
    for (const step of steps) {
      const result = applied(arrangement, step);
      if (!result.ok) throw new Error(result.error);
      arrangement = result.arrangement;
    }
    expect(arrangement!.sections.find((each) => each.kind === "album")).toEqual({ kind: "album", collapsed: true, heading: "Our pictures", style: "strip" });
  });

  it("adds a Note or Links, on and empty, after the section named or at the end", () => {
    const result = applied(null, { type: "addNote", after: "comments", heading: "Dress code" });
    expect(result.ok && keys(result.arrangement.sections).slice(5, 7)).toEqual(["comments", "note:made0001"]);
    expect(result.ok && result.arrangement.sections[6]).toEqual({ kind: "note", id: "made0001", on: true, collapsed: false, heading: "Dress code", body: { blocks: [] } });

    const atEnd = applied(null, { type: "addLinks", after: null, heading: null });
    expect(atEnd.ok && atEnd.arrangement.sections.at(-1)).toEqual({ kind: "links", id: "made0001", on: true, collapsed: false, heading: null, links: [] });
    expect(applied(null, { type: "addNote", after: "map", heading: null })).toEqual({ ok: false, error: "unknownSection" });
  });

  it("holds a page to ten written sections", () => {
    const nine = arranged((sections) => [...sections, ...Array.from({ length: 9 }, (_, n) => note(`aaaaaaa${n}`))]);
    expect(applied(nine, { type: "addLinks", after: null, heading: null }).ok).toBe(true);
    const ten = arranged((sections) => [...sections, ...Array.from({ length: 10 }, (_, n) => note(`aaaaaaa${n}`))]);
    expect(applied(ten, { type: "addNote", after: null, heading: null })).toEqual({ ok: false, error: "tooManySections" });
  });

  it("writes and removes a Note or Links, and only those", () => {
    const written = arranged((sections) => [...sections, note("aaaaaaaa"), links("bbbbbbbb")]);

    const edited = applied(written, { type: "editNote", key: "note:aaaaaaaa", body: body("Black tie") });
    expect(edited.ok && edited.arrangement.sections.find((each) => each.kind === "note")).toMatchObject({ body: body("Black tie") });
    const relinked = applied(written, { type: "editLinks", key: "links:bbbbbbbb", links: [{ label: "", url: "https://c.example/" }] });
    expect(relinked.ok && relinked.arrangement.sections.find((each) => each.kind === "links")).toMatchObject({ links: [{ label: "", url: "https://c.example/" }] });
    const removed = applied(written, { type: "remove", key: "note:aaaaaaaa" });
    expect(removed.ok && keys(removed.arrangement.sections)).toEqual([...POSTER, "links:bbbbbbbb"]);

    expect(applied(written, { type: "editNote", key: "links:bbbbbbbb", body: body("x") })).toEqual({ ok: false, error: "notOffered" });
    expect(applied(written, { type: "editLinks", key: "album", links: [] })).toEqual({ ok: false, error: "notOffered" });
    expect(applied(written, { type: "editLinks", key: "note:aaaaaaaa", links: [] })).toEqual({ ok: false, error: "notOffered" });
  });

  it("switches a written section off without losing it", () => {
    const written = arranged((sections) => [...sections, note("aaaaaaaa")]);
    const result = applied(written, { type: "toggle", key: "note:aaaaaaaa", on: false });
    expect(result.ok && result.arrangement.sections.at(-1)).toEqual(note("aaaaaaaa", { on: false }));
  });
});

describe("switchesAfter", () => {
  const toggle = (key: string, on: boolean): ArrangementChange => ({ type: "toggle", key, on });

  it("turns a column's switch with its section", () => {
    expect(switchesAfter(SWITCHES, toggle("comments", false))).toEqual({ ...SWITCHES, commentsEnabled: false });
    expect(switchesAfter(SWITCHES, toggle("letter", false))).toEqual({ ...SWITCHES, lettersEnabled: false });
    expect(switchesAfter(SWITCHES, toggle("album", false))).toEqual({ ...SWITCHES, albumEnabled: false });
    expect(switchesAfter(SWITCHES, toggle("guests", false))).toEqual({ ...SWITCHES, guestListVisibility: "hidden" });
    expect(switchesAfter({ ...SWITCHES, guestListVisibility: "hidden" }, toggle("guests", true))).toEqual({ ...SWITCHES, guestListVisibility: "afterReply" });
  });

  it("sets who sees the guest list", () => {
    expect(switchesAfter(SWITCHES, { type: "audience", visibility: "always" })).toEqual({ ...SWITCHES, guestListVisibility: "always" });
  });

  it("leaves the switches as they were for any other change", () => {
    for (const other of [toggle("schedule", false), { type: "move", key: "album", past: "comments" }, { type: "remove", key: "note:aaaaaaaa" }] as ArrangementChange[]) {
      expect(switchesAfter(SWITCHES, other)).toEqual(SWITCHES);
    }
  });
});

describe("sectionOn", () => {
  it("is on by default but for the countdown, and off where the host switched it off, in every layout", () => {
    expect(sectionOn(null, "schedule")).toBe(true);
    expect(sectionOn(null, "announcements")).toBe(true);
    expect(sectionOn(null, "countdown")).toBe(false);
    const off = arranged((sections) => sections.map((section) => (section.kind === "schedule" ? { ...section, on: false } : section)));
    expect(sectionOn(off, "schedule")).toBe(false);
    expect(sectionOn(off, "announcements")).toBe(true);
  });

  it("leaves a section whose switch is a column, or that has none, to its drawing", () => {
    for (const kind of ["letter", "details", "guests", "comments", "album"] as const) expect(sectionOn(arranged(), kind)).toBe(true);
  });
});

describe("sheetRows", () => {
  it("gives a row per section, on as its switch says, and no album row where the site has no album", () => {
    const switches: Switches = { ...SWITCHES, guestListVisibility: "hidden", commentsEnabled: false };
    const rows = sheetRows(null, "poster", switches, { album: true });
    expect(rows.map((row) => row.key)).toEqual(POSTER);
    const on = Object.fromEntries(rows.map((row) => [row.key, row.on]));
    expect(on).toEqual({ letter: true, details: true, schedule: true, guests: false, announcements: true, comments: false, album: true, countdown: false });
    expect(rows.find((row) => row.key === "album")).toEqual({ key: "album", kind: "album", heading: null, on: true, collapsed: false, style: "grid" });
    expect(sheetRows(null, "poster", switches, { album: false }).map((row) => row.key)).not.toContain("album");
  });

  it("follows the arrangement's order and what it stores", () => {
    const written = arranged((sections) => [note("aaaaaaaa", { heading: "Dress code", collapsed: true }), ...sections]);
    expect(sheetRows(written, "poster", { ...SWITCHES, albumEnabled: false }, { album: true })[0]).toEqual({
      key: "note:aaaaaaaa",
      kind: "note",
      heading: "Dress code",
      on: true,
      collapsed: true,
      style: null,
    });
    expect(sheetRows(written, "poster", { ...SWITCHES, albumEnabled: false }, { album: true }).find((row) => row.kind === "album")?.on).toBe(false);
  });
});

describe("sectionId", () => {
  it("is eight lowercase letters and digits, different each time", () => {
    const first = sectionId();
    expect(first).toMatch(/^[0-9a-z]{8}$/);
    expect(sectionId()).not.toBe(first);
  });
});
