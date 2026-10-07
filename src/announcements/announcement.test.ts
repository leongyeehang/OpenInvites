import { describe, expect, it } from "vitest";
import { parseAnnouncement, roomForAnother } from "./announcement";

describe("parseAnnouncement", () => {
  it("takes the host's words trimmed, with their line breaks", () => {
    expect(parseAnnouncement({ body: "  The gate code is 1234.\nRing twice.\n ", audience: ["going"] })).toEqual({
      ok: true,
      announcement: { body: "The gate code is 1234.\nRing twice.", audience: ["going"] },
    });
  });

  it("wants something to say", () => {
    expect(parseAnnouncement({ body: "", audience: ["going"] })).toEqual({ ok: false, error: "bodyRequired" });
    expect(parseAnnouncement({ body: " \n\t ", audience: ["going"] })).toEqual({ ok: false, error: "bodyRequired" });
  });

  it("carries up to 2000 characters and no more", () => {
    expect(parseAnnouncement({ body: "a".repeat(2000), audience: ["going"] })).toEqual({
      ok: true,
      announcement: { body: "a".repeat(2000), audience: ["going"] },
    });
    expect(parseAnnouncement({ body: "a".repeat(2001), audience: ["going"] })).toEqual({ ok: false, error: "bodyTooLong" });
  });

  it("counts a line break as one character, as the browser posts it or not", () => {
    // A browser posts a textarea's line breaks as CR LF.
    const posted = `${"a".repeat(1000)}\r\n${"a".repeat(999)}`;
    expect(parseAnnouncement({ body: posted, audience: ["going"] })).toEqual({
      ok: true,
      announcement: { body: `${"a".repeat(1000)}\n${"a".repeat(999)}`, audience: ["going"] },
    });
  });

  it("wants at least one status to email", () => {
    expect(parseAnnouncement({ body: "Bring a jacket.", audience: [] })).toEqual({ ok: false, error: "audienceRequired" });
  });

  it("refuses a status no guest can give", () => {
    expect(parseAnnouncement({ body: "Bring a jacket.", audience: ["going", "invited"] })).toEqual({ ok: false, error: "audienceInvalid" });
    expect(parseAnnouncement({ body: "Bring a jacket.", audience: [""] })).toEqual({ ok: false, error: "audienceInvalid" });
  });

  it("keeps each status once, in the order the RSVP buttons show them", () => {
    expect(parseAnnouncement({ body: "Bring a jacket.", audience: ["cant", "going", "cant"] })).toEqual({
      ok: true,
      announcement: { body: "Bring a jacket.", audience: ["going", "cant"] },
    });
  });
});

describe("roomForAnother", () => {
  it("lets an event have ten announcements, and refuses the eleventh", () => {
    expect(roomForAnother(0)).toBe(true);
    expect(roomForAnother(9)).toBe(true);
    expect(roomForAnother(10)).toBe(false);
    expect(roomForAnother(11)).toBe(false);
  });
});
