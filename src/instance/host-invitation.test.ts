import { describe, expect, it } from "vitest";
import { hostInvitationDaysLeft, hostInvitationExpiry, hostInvitationState } from "./host-invitation";

const DAY = 24 * 60 * 60 * 1000;
const created = new Date("2026-09-24T10:00:00Z");
const expiresAt = hostInvitationExpiry(created);

describe("hostInvitationExpiry", () => {
  it("is fourteen days after the invitation was made", () => {
    expect(expiresAt).toEqual(new Date("2026-10-08T10:00:00Z"));
  });
});

describe("hostInvitationState", () => {
  const fresh = { usedAt: null, revokedAt: null, expiresAt };

  it("is pending until it is used, revoked, or runs out", () => {
    expect(hostInvitationState(fresh, created)).toBe("pending");
    expect(hostInvitationState(fresh, new Date(expiresAt.getTime() - 1))).toBe("pending");
  });

  it("expires at the end of its fourteen days, so a dead link never reads as live", () => {
    expect(hostInvitationState(fresh, expiresAt)).toBe("expired");
    expect(hostInvitationState(fresh, new Date(expiresAt.getTime() + 30 * DAY))).toBe("expired");
  });

  it("is used once someone has signed up with it, however long ago", () => {
    const used = { ...fresh, usedAt: new Date(created.getTime() + DAY) };
    expect(hostInvitationState(used, created)).toBe("used");
    expect(hostInvitationState(used, new Date(expiresAt.getTime() + DAY))).toBe("used");
  });

  it("is revoked once the operator has revoked it, even after it would have expired", () => {
    const revoked = { ...fresh, revokedAt: new Date(created.getTime() + DAY) };
    expect(hostInvitationState(revoked, created)).toBe("revoked");
    expect(hostInvitationState(revoked, new Date(expiresAt.getTime() + DAY))).toBe("revoked");
  });
});

describe("hostInvitationDaysLeft", () => {
  it("counts a part of a day as a day", () => {
    expect(hostInvitationDaysLeft(expiresAt, created)).toBe(14);
    expect(hostInvitationDaysLeft(expiresAt, new Date(created.getTime() + 1))).toBe(14);
    expect(hostInvitationDaysLeft(expiresAt, new Date(expiresAt.getTime() - DAY))).toBe(1);
    expect(hostInvitationDaysLeft(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(1);
  });
});
