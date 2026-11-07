import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rsvp } from "./repository";
import { guestRsvp } from "./guest";

const BASE = "https://invites.example.test";

const REPLY = {
  id: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a",
  status: "going",
  approval: "approved",
  name: "Mei Lin",
  plusOnes: 0,
  plusOneNames: [],
  email: "mei@example.test",
  phone: null,
  inviteId: null,
} as unknown as Rsvp;

describe("guestRsvp's edit link", () => {
  beforeEach(() => vi.stubEnv("BASE_URL", BASE));
  afterEach(() => vi.unstubAllEnvs());

  it("is the reply's own link when it is tied to no invite", () => {
    expect(guestRsvp({ rsvp: REPLY, token: "edit-token", inviteToken: null }, null).editLink).toBe(`${BASE}/r/edit-token`);
  });

  it("is the invite's link whenever the reply is tied to one, even when its edit token is another", () => {
    const tied = { ...REPLY, inviteId: "0b9e8d7c-6b5a-4f3e-9d2c-1b0a9f8e7d6c" };
    // Made through the invite: the invite's token is its edit token.
    expect(guestRsvp({ rsvp: tied, token: "invite-token", inviteToken: "invite-token" }, null).editLink).toBe(`${BASE}/i/invite-token`);
    // Made before the invite was (M6 ticket 08): it keeps an edit token of its own.
    expect(guestRsvp({ rsvp: tied, token: "own-edit-token", inviteToken: "invite-token" }, null).editLink).toBe(`${BASE}/i/invite-token`);
  });
});
