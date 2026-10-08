import { describe, expect, it } from "vitest";
import { mayDelete, parseComment, roomForAnother } from "./comment";

describe("parseComment", () => {
  it("takes the words trimmed, with their line breaks", () => {
    expect(parseComment("  I’ll bring the cake.\nAnd candles.\n ")).toEqual({ ok: true, body: "I’ll bring the cake.\nAnd candles." });
  });

  it("wants something to say", () => {
    expect(parseComment("")).toEqual({ ok: false, error: "bodyRequired" });
    expect(parseComment(" \n\t ")).toEqual({ ok: false, error: "bodyRequired" });
  });

  it("carries from 1 to 1000 characters and no more", () => {
    expect(parseComment("!")).toEqual({ ok: true, body: "!" });
    expect(parseComment("a".repeat(1000))).toEqual({ ok: true, body: "a".repeat(1000) });
    expect(parseComment("a".repeat(1001))).toEqual({ ok: false, error: "bodyTooLong" });
  });

  it("counts a line break as one character, as the browser posts it or not", () => {
    // A browser posts a textarea's line breaks as CR LF.
    expect(parseComment(`${"a".repeat(500)}\r\n${"a".repeat(499)}`)).toEqual({ ok: true, body: `${"a".repeat(500)}\n${"a".repeat(499)}` });
    expect(parseComment(`${"a".repeat(500)}\r\n${"a".repeat(500)}`)).toEqual({ ok: false, error: "bodyTooLong" });
  });

  it("keeps the spaces inside the text as written", () => {
    expect(parseComment("Menu:\n  soup\n  cake")).toEqual({ ok: true, body: "Menu:\n  soup\n  cake" });
  });
});

describe("roomForAnother", () => {
  it("lets an event have 500 comments, and refuses the 501st", () => {
    expect(roomForAnother(0)).toBe(true);
    expect(roomForAnother(499)).toBe(true);
    expect(roomForAnother(500)).toBe(false);
    expect(roomForAnother(501)).toBe(false);
  });
});

describe("mayDelete", () => {
  const guests = { rsvpId: "rsvp-priya", hostId: null };
  const others = { rsvpId: "rsvp-mei", hostId: null };
  const hosts = { rsvpId: null, hostId: "host-ada" };

  it("lets a guest delete their own comment and nobody else's", () => {
    const priya = { kind: "guest", rsvpId: "rsvp-priya" } as const;
    expect(mayDelete(priya, guests)).toBe(true);
    expect(mayDelete(priya, others)).toBe(false);
    expect(mayDelete(priya, hosts)).toBe(false);
  });

  it("lets a host delete any comment", () => {
    const host = { kind: "host" } as const;
    expect(mayDelete(host, guests)).toBe(true);
    expect(mayDelete(host, others)).toBe(true);
    expect(mayDelete(host, hosts)).toBe(true);
  });

  it("lets someone who has not replied delete nothing", () => {
    const visitor = { kind: "visitor" } as const;
    expect(mayDelete(visitor, guests)).toBe(false);
    expect(mayDelete(visitor, hosts)).toBe(false);
  });
});
