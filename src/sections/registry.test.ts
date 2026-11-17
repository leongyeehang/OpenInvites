import { describe, expect, it } from "vitest";
import type { SectionKind } from "./arrangement";
import { REGISTRY } from "./registry";

const KINDS: SectionKind[] = ["letter", "details", "schedule", "guests", "announcements", "comments", "album", "countdown", "note", "links"];

describe("the section registry", () => {
  it("has an entry for every kind of section, and nothing else", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...KINDS].sort());
  });

  it("says where each section's switch lives: none for Details, a column for four, the arrangement for the rest", () => {
    const column = ["letter", "guests", "comments", "album"];
    for (const kind of KINDS) {
      expect(REGISTRY[kind].switch, kind).toBe(kind === "details" ? "none" : column.includes(kind) ? "column" : "stored");
    }
  });

  it("offers Collapsed to every section but the Letter, Details and the Countdown, and a new heading to all but the first two", () => {
    for (const kind of KINDS) {
      expect(REGISTRY[kind].collapse, kind).toBe(!["letter", "details", "countdown"].includes(kind));
      expect(REGISTRY[kind].rename, kind).toBe(!["letter", "details"].includes(kind));
    }
  });

  it("offers styles to the album, the comments and Who's coming only, today's drawing first", () => {
    const styles: Partial<Record<SectionKind, string[]>> = {
      album: ["grid", "mosaic", "strip"],
      comments: ["list", "bubbles"],
      guests: ["names", "avatars"],
    };
    for (const kind of KINDS) expect(REGISTRY[kind].styles, kind).toEqual(styles[kind] ?? []);
  });

  it("heads a section with each layout's own words, and Details only in the Broadsheet", () => {
    expect(REGISTRY.guests.heading.thread).toBe("thread.guests");
    expect(REGISTRY.details.heading.broadsheet).toBe("broadsheet.details");
    expect(REGISTRY.details.heading.poster).toBeNull();
    expect(REGISTRY.details.heading.thread).toBeNull();
  });

  it("draws the album, the schedule and the comments wide, and ties the album to the site's Album feature", () => {
    for (const kind of KINDS) expect(REGISTRY[kind].wide, kind).toBe(["album", "schedule", "comments"].includes(kind));
    expect(REGISTRY.album.feature).toBe("album");
    for (const kind of KINDS.filter((kind) => kind !== "album")) expect(REGISTRY[kind].feature, kind).toBeUndefined();
  });

  it("gives every section an icon", () => {
    for (const kind of KINDS) expect(REGISTRY[kind].icon, kind).toBeTruthy();
  });
});
