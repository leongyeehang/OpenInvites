import { describe, expect, it } from "vitest";
import { MIN_FREE_BYTES } from "@/lib/sizes";
import { albumRoom, albumState, MAX_CAPTION, mayAddPhotos, mayApprovePhoto, mayCaption, mayDeletePhoto, parseCaption, storageRoom } from "./album";

const START = new Date("2027-05-08T11:00:00Z");

describe("albumState", () => {
  it("opens at the event's start, and not before", () => {
    expect(albumState({ state: "published", startsAt: START }, new Date("2027-05-08T10:59:59Z"), true)).toBe("notYet");
    expect(albumState({ state: "published", startsAt: START }, START, true)).toBe("open");
    expect(albumState({ state: "published", startsAt: START }, new Date("2028-01-01T00:00:00Z"), true)).toBe("open");
  });

  it("is none for a draft, a cancelled event, or one with no date yet", () => {
    expect(albumState({ state: "draft", startsAt: START }, START, true)).toBe("none");
    expect(albumState({ state: "cancelled", startsAt: START }, START, true)).toBe("none");
    expect(albumState({ state: "published", startsAt: null }, START, true)).toBe("none");
  });

  // M8 ticket 01: the operator's Album switch.
  it("is none for every event while the operator has the album switched off", () => {
    expect(albumState({ state: "published", startsAt: START }, START, false)).toBe("none");
    expect(albumState({ state: "published", startsAt: START }, new Date("2027-05-08T10:59:59Z"), false)).toBe("none");
  });
});

describe("who adds to the album", () => {
  it("is the hosts and a guest whose reply is approved, whatever they said", () => {
    expect(mayAddPhotos({ kind: "host", hostId: "h1" })).toBe(true);
    expect(mayAddPhotos({ kind: "guest", rsvpId: "r1", approval: "approved", status: "going", name: "Priya Nair" })).toBe(true);
    expect(mayAddPhotos({ kind: "guest", rsvpId: "r1", approval: "approved", status: "cant", name: "Priya Nair" })).toBe(true);
    expect(mayAddPhotos({ kind: "guest", rsvpId: "r1", approval: "pending", status: "going", name: "Priya Nair" })).toBe(false);
    expect(mayAddPhotos({ kind: "guest", rsvpId: "r1", approval: "declined", status: "going", name: "Priya Nair" })).toBe(false);
    expect(mayAddPhotos({ kind: "visitor" })).toBe(false);
  });

  it("lets only a host approve a photo", () => {
    expect(mayApprovePhoto({ kind: "host", hostId: "h1" })).toBe(true);
    expect(mayApprovePhoto({ kind: "guest", rsvpId: "r1", approval: "approved", status: "going", name: "Priya Nair" })).toBe(false);
    expect(mayApprovePhoto({ kind: "visitor" })).toBe(false);
  });

  it("lets a host delete any photo and a guest their own", () => {
    expect(mayDeletePhoto({ kind: "host", hostId: "h1" }, { rsvpId: "r2" })).toBe(true);
    expect(mayDeletePhoto({ kind: "guest", rsvpId: "r1", approval: "approved", status: "going", name: "Priya Nair" }, { rsvpId: "r1" })).toBe(true);
    expect(mayDeletePhoto({ kind: "guest", rsvpId: "r1", approval: "approved", status: "going", name: "Priya Nair" }, { rsvpId: "r2" })).toBe(false);
    expect(mayDeletePhoto({ kind: "guest", rsvpId: "r1", approval: "approved", status: "going", name: "Priya Nair" }, { rsvpId: null })).toBe(false);
    expect(mayDeletePhoto({ kind: "visitor" }, { rsvpId: "r1" })).toBe(false);
  });
});

// M7 ticket 02: the site's storage and the disk, checked for every upload, posters included.
describe("storageRoom", () => {
  const GB = 1024 * 1024 * 1024;

  it("takes an upload that keeps the site within its storage, exactly full included", () => {
    expect(storageRoom({ siteBytes: 10 * GB, freeBytes: 50 * GB }, 5 * GB, 50 * GB)).toEqual({ ok: true });
    expect(storageRoom({ siteBytes: 45 * GB, freeBytes: 50 * GB }, 5 * GB, 50 * GB)).toEqual({ ok: true });
  });

  it("refuses what would take the site past its storage, naming the limit", () => {
    expect(storageRoom({ siteBytes: 46 * GB, freeBytes: undefined }, 5 * GB, 50 * GB)).toEqual({ ok: false, error: "siteFull", limit: 50 * GB });
  });

  it("refuses what would leave the disk under a gigabyte free, and never refuses for a disk it cannot see", () => {
    expect(storageRoom({ siteBytes: 0, freeBytes: 1.5 * GB }, 0.6 * GB, 50 * GB)).toEqual({ ok: false, error: "diskFull", limit: MIN_FREE_BYTES });
    expect(storageRoom({ siteBytes: 0, freeBytes: 1.5 * GB }, 0.5 * GB, 50 * GB)).toEqual({ ok: true });
    expect(storageRoom({ siteBytes: 0, freeBytes: undefined }, 100 * GB, 500 * GB)).toEqual({ ok: true });
  });
});

// The album's room: in items (M4 ticket 11), then in bytes (M7 ticket 02).
describe("albumRoom", () => {
  const MB = 1024 * 1024;
  const held = { items: 0, bytes: 0, siteBytes: 0, freeBytes: undefined };
  const caps = { maxItems: 300, maxEventBytes: 100 * MB, maxSiteBytes: 1000 * MB };

  it("takes up to ten at once while the album has room in items and in bytes", () => {
    expect(albumRoom(held, { items: 10, bytes: 50 * MB }, caps)).toEqual({ ok: true });
    expect(albumRoom({ ...held, items: 290, bytes: 90 * MB }, { items: 10, bytes: 10 * MB }, caps)).toEqual({ ok: true });
  });

  it("refuses more than ten at once, and more than the album's places, saying how many are left", () => {
    expect(albumRoom(held, { items: 11, bytes: 0 }, caps)).toEqual({ ok: false, error: "tooMany", left: 300, limit: 300 });
    expect(albumRoom({ ...held, items: 295 }, { items: 6, bytes: 0 }, caps)).toEqual({ ok: false, error: "albumFull", left: 5, limit: 300 });
    expect(albumRoom({ ...held, items: 300 }, { items: 1, bytes: 0 }, caps)).toEqual({ ok: false, error: "albumFull", left: 0, limit: 300 });
  });

  it("refuses what would take the album past its storage, naming the limit", () => {
    expect(albumRoom({ ...held, bytes: 95 * MB }, { items: 1, bytes: 6 * MB }, caps)).toEqual({ ok: false, error: "albumStorageFull", left: 300, limit: 100 * MB });
    expect(albumRoom({ ...held, bytes: 95 * MB }, { items: 1, bytes: 5 * MB }, caps)).toEqual({ ok: true });
  });

  it("then checks the site's storage and the disk", () => {
    expect(albumRoom({ ...held, siteBytes: 995 * MB }, { items: 1, bytes: 6 * MB }, caps)).toEqual({ ok: false, error: "siteFull", left: 300, limit: 1000 * MB });
    expect(albumRoom({ ...held, freeBytes: MIN_FREE_BYTES }, { items: 1, bytes: 1 }, caps)).toEqual({ ok: false, error: "diskFull", left: 300, limit: MIN_FREE_BYTES });
  });
});

// M8 ticket 09: a caption is plain text of at most 140 characters, counted as Postgres counts them.
describe("parseCaption", () => {
  it("trims the caption", () => {
    expect(parseCaption("  Sunset over the lake  ")).toEqual({ ok: true, caption: "Sunset over the lake" });
  });

  it("makes each line break one space", () => {
    expect(parseCaption("a\r\nb\nc")).toEqual({ ok: true, caption: "a b c" });
    expect(parseCaption("a\u2028b\u2029c")).toEqual({ ok: true, caption: "a b c" });
  });

  it("makes a tab and other control characters spaces, and runs of spaces one", () => {
    expect(parseCaption("a\tb\u0000c\u007fd\u0085e   f")).toEqual({ ok: true, caption: "a b c d e f" });
  });

  it("drops the bidi and zero-width characters plainText drops", () => {
    expect(parseCaption("a\u202eb\u200bc\ufeffd")).toEqual({ ok: true, caption: "abcd" });
  });

  it("removes the caption when nothing is left", () => {
    expect(parseCaption("")).toEqual({ ok: true, caption: null });
    expect(parseCaption("   ")).toEqual({ ok: true, caption: null });
    expect(parseCaption("\n\t\u200b")).toEqual({ ok: true, caption: null });
  });

  it("takes 140 characters and refuses 141", () => {
    expect(MAX_CAPTION).toBe(140);
    expect(parseCaption("a".repeat(140))).toEqual({ ok: true, caption: "a".repeat(140) });
    expect(parseCaption("a".repeat(141))).toEqual({ ok: false, error: "captionTooLong" });
  });

  it("counts by code point, so 140 emoji pass", () => {
    expect(parseCaption("🌅".repeat(140))).toEqual({ ok: true, caption: "🌅".repeat(140) });
    expect(parseCaption("🌅".repeat(141))).toEqual({ ok: false, error: "captionTooLong" });
  });
});

describe("mayCaption", () => {
  it("is a host for any item", () => {
    expect(mayCaption({ kind: "host", hostId: "h1" }, { rsvpId: "r1" })).toBe(true);
    expect(mayCaption({ kind: "host", hostId: "h1" }, { rsvpId: null })).toBe(true);
  });

  it("is a guest for an item their RSVP added, and nobody else", () => {
    const guest = (rsvpId: string) => ({ kind: "guest" as const, rsvpId, approval: "approved" as const, status: "going" as const, name: "Priya Nair" });
    expect(mayCaption(guest("r1"), { rsvpId: "r1" })).toBe(true);
    expect(mayCaption(guest("r2"), { rsvpId: "r1" })).toBe(false);
    expect(mayCaption(guest("r2"), { rsvpId: null })).toBe(false);
    expect(mayCaption({ kind: "visitor" }, { rsvpId: "r1" })).toBe(false);
  });
});
