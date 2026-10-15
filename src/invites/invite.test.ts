import { describe, expect, it } from "vitest";
import { SLUG_ALPHABET } from "@/events/slug";
import { generateInviteToken, inviteState, MAX_INVITES, parseInvite, roomForInvite } from "./invite";

describe("parseInvite", () => {
  it("takes a name, trimmed, and no email", () => {
    expect(parseInvite({ name: "  Mei Lin ", email: "" })).toEqual({ ok: true, invite: { name: "Mei Lin", email: null } });
    expect(parseInvite({ name: "Mei Lin", email: "   " })).toEqual({ ok: true, invite: { name: "Mei Lin", email: null } });
  });

  it("takes an email, trimmed, by the RSVP form's rule", () => {
    expect(parseInvite({ name: "Mei Lin", email: " mei@example.test " })).toEqual({ ok: true, invite: { name: "Mei Lin", email: "mei@example.test" } });
  });

  it("refuses an invite without a name", () => {
    expect(parseInvite({ name: "", email: "mei@example.test" })).toEqual({ ok: false, error: "nameRequired" });
    expect(parseInvite({ name: "   ", email: "" })).toEqual({ ok: false, error: "nameRequired" });
  });

  it("takes a name of up to 80 characters, as the RSVP form does, and no longer", () => {
    expect(parseInvite({ name: "a".repeat(80), email: "" })).toEqual({ ok: true, invite: { name: "a".repeat(80), email: null } });
    expect(parseInvite({ name: ` ${"a".repeat(80)} `, email: "" })).toEqual({ ok: true, invite: { name: "a".repeat(80), email: null } });
    expect(parseInvite({ name: "a".repeat(81), email: "" })).toEqual({ ok: false, error: "nameTooLong" });
  });

  it("refuses an email that is not one", () => {
    expect(parseInvite({ name: "Mei Lin", email: "mei" })).toEqual({ ok: false, error: "emailInvalid" });
    expect(parseInvite({ name: "Mei Lin", email: "mei@example" })).toEqual({ ok: false, error: "emailInvalid" });
    expect(parseInvite({ name: "Mei Lin", email: `${"m".repeat(250)}@example.test` })).toEqual({ ok: false, error: "emailInvalid" });
  });
});

describe("inviteState", () => {
  const opened = new Date("2026-10-12T10:00:00Z");

  it("is not opened until the guest opens the link", () => {
    expect(inviteState({ openedAt: null, rsvpId: null })).toBe("notOpened");
  });

  it("is opened once the guest has opened the link", () => {
    expect(inviteState({ openedAt: opened, rsvpId: null })).toBe("opened");
  });

  it("is replied once the guest has replied through it, whatever else", () => {
    expect(inviteState({ openedAt: opened, rsvpId: "0199d0a4-0000-7000-8000-000000000001" })).toBe("replied");
    expect(inviteState({ openedAt: null, rsvpId: "0199d0a4-0000-7000-8000-000000000001" })).toBe("replied");
  });
});

describe("roomForInvite", () => {
  it("takes invites up to five hundred an event, and no more", () => {
    expect(MAX_INVITES).toBe(500);
    expect(roomForInvite(0)).toBe(true);
    expect(roomForInvite(499)).toBe(true);
    expect(roomForInvite(500)).toBe(false);
    expect(roomForInvite(501)).toBe(false);
  });
});

describe("the token", () => {
  it("is 24 characters of the event link's alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateInviteToken();
      expect(token).toHaveLength(24);
      expect([...token].every((char) => SLUG_ALPHABET.includes(char))).toBe(true);
    }
  });

  it("is drawn afresh for every invite", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInviteToken));
    expect(tokens.size).toBe(200);
  });

  it("draws on the whole alphabet", () => {
    const seen = new Set(Array.from({ length: 200 }, generateInviteToken).join(""));
    expect(seen.size).toBe(SLUG_ALPHABET.length);
  });
});
