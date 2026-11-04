import { describe, expect, it } from "vitest";
import { albumState, mayDeletePhoto, mayUseAlbum, photosRoom } from "./album";

const START = new Date("2027-05-08T11:00:00Z");

describe("albumState", () => {
  it("opens at the event's start, and not before", () => {
    expect(albumState({ state: "published", startsAt: START }, new Date("2027-05-08T10:59:59Z"))).toBe("notYet");
    expect(albumState({ state: "published", startsAt: START }, START)).toBe("open");
    expect(albumState({ state: "published", startsAt: START }, new Date("2028-01-01T00:00:00Z"))).toBe("open");
  });

  it("is none for a draft, a cancelled event, or one with no date yet", () => {
    expect(albumState({ state: "draft", startsAt: START }, START)).toBe("none");
    expect(albumState({ state: "cancelled", startsAt: START }, START)).toBe("none");
    expect(albumState({ state: "published", startsAt: null }, START)).toBe("none");
  });
});

describe("who uses the album", () => {
  it("is the hosts and a guest whose reply is approved", () => {
    expect(mayUseAlbum({ kind: "host", hostId: "h1" })).toBe(true);
    expect(mayUseAlbum({ kind: "guest", rsvpId: "r1", approval: "approved" })).toBe(true);
    expect(mayUseAlbum({ kind: "guest", rsvpId: "r1", approval: "pending" })).toBe(false);
    expect(mayUseAlbum({ kind: "guest", rsvpId: "r1", approval: "declined" })).toBe(false);
    expect(mayUseAlbum({ kind: "visitor" })).toBe(false);
  });

  it("lets a host delete any photo and a guest their own", () => {
    expect(mayDeletePhoto({ kind: "host", hostId: "h1" }, { rsvpId: "r2" })).toBe(true);
    expect(mayDeletePhoto({ kind: "guest", rsvpId: "r1", approval: "approved" }, { rsvpId: "r1" })).toBe(true);
    expect(mayDeletePhoto({ kind: "guest", rsvpId: "r1", approval: "approved" }, { rsvpId: "r2" })).toBe(false);
    expect(mayDeletePhoto({ kind: "guest", rsvpId: "r1", approval: "approved" }, { rsvpId: null })).toBe(false);
    expect(mayDeletePhoto({ kind: "visitor" }, { rsvpId: "r1" })).toBe(false);
  });
});

describe("photosRoom", () => {
  it("takes up to ten at once while the album has room", () => {
    expect(photosRoom(0, 10, 300)).toEqual({ ok: true });
    expect(photosRoom(290, 10, 300)).toEqual({ ok: true });
  });

  it("refuses more than ten at once, and more than the album's room, saying how many are left", () => {
    expect(photosRoom(0, 11, 300)).toEqual({ ok: false, error: "tooMany", left: 300 });
    expect(photosRoom(295, 6, 300)).toEqual({ ok: false, error: "albumFull", left: 5 });
    expect(photosRoom(300, 1, 300)).toEqual({ ok: false, error: "albumFull", left: 0 });
  });
});
