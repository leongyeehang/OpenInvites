import { describe, expect, it } from "vitest";
import type { AlbumViewer } from "./album";
import { ALBUM_VISIBILITIES, albumView, photoScope, photoStatusFor } from "./visibility";

const host: AlbumViewer = { kind: "host", hostId: "h1" };
const visitor: AlbumViewer = { kind: "visitor" };
const guest = (status: "going" | "maybe" | "cant" | "waitlisted", approval: "approved" | "pending" | "declined" = "approved"): AlbumViewer => ({
  kind: "guest",
  rsvpId: "r1",
  approval,
  status,
  name: "Priya Nair",
});

describe("albumView", () => {
  it("opens every album to the hosts, in every mode", () => {
    for (const albumVisibility of ALBUM_VISIBILITIES) expect(albumView({ albumVisibility }, host)).toBe("open");
  });

  it("opens the album to an approved guest under replied, whatever they said", () => {
    expect(albumView({ albumVisibility: "replied" }, guest("going"))).toBe("open");
    expect(albumView({ albumVisibility: "replied" }, guest("maybe"))).toBe("open");
    expect(albumView({ albumVisibility: "replied" }, guest("cant"))).toBe("open");
    expect(albumView({ albumVisibility: "replied" }, guest("waitlisted"))).toBe("open");
  });

  it("under going, opens it to a Going guest, and shows Maybe, Can't go and a waitlisted reply only their own", () => {
    expect(albumView({ albumVisibility: "going" }, guest("going"))).toBe("open");
    expect(albumView({ albumVisibility: "going" }, guest("maybe"))).toBe("own");
    expect(albumView({ albumVisibility: "going" }, guest("cant"))).toBe("own");
    expect(albumView({ albumVisibility: "going" }, guest("waitlisted"))).toBe("own");
  });

  it("under hosts, shows an approved guest only their own", () => {
    expect(albumView({ albumVisibility: "hosts" }, guest("going"))).toBe("own");
    expect(albumView({ albumVisibility: "hosts" }, guest("maybe"))).toBe("own");
  });

  it("locks out a pending or declined guest, and a visitor, in every mode", () => {
    for (const albumVisibility of ALBUM_VISIBILITIES) {
      expect(albumView({ albumVisibility }, guest("going", "pending"))).toBe("locked");
      expect(albumView({ albumVisibility }, guest("going", "declined"))).toBe("locked");
      expect(albumView({ albumVisibility }, visitor)).toBe("locked");
    }
  });
});

describe("photoScope", () => {
  it("is every photo for a host", () => {
    expect(photoScope("open", { kind: "host", hostId: "h1" })).toBe("all");
  });

  it("is the approved photos and their own for a guest the album is open to", () => {
    expect(photoScope("open", { kind: "guest", rsvpId: "r1", approval: "approved", status: "going", name: "Priya Nair" })).toEqual({ approved: true, own: "r1" });
  });

  it("is their own alone for a guest shown only their own", () => {
    expect(photoScope("own", { kind: "guest", rsvpId: "r1", approval: "approved", status: "maybe", name: "Priya Nair" })).toEqual({ own: "r1" });
  });
});

describe("photoStatusFor", () => {
  it("leaves a guest's photo pending while the host approves photos", () => {
    expect(photoStatusFor({ albumApprovalRequired: true }, guest("going"))).toBe("pending");
  });

  it("approves a host's own photo at once, even with approval on", () => {
    expect(photoStatusFor({ albumApprovalRequired: true }, host)).toBe("approved");
  });

  it("approves every photo while approval is off", () => {
    expect(photoStatusFor({ albumApprovalRequired: false }, guest("going"))).toBe("approved");
    expect(photoStatusFor({ albumApprovalRequired: false }, host)).toBe("approved");
  });
});
