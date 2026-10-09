import { describe, expect, it } from "vitest";
import {
  coHostLinkExpiry,
  coHostLinkState,
  generateCoHostLinkToken,
  hashCoHostLinkToken,
  MAX_CO_HOSTS,
  roomForCoHost,
} from "./co-host-link";

const DAY = 24 * 60 * 60 * 1000;
const created = new Date("2026-10-07T10:00:00Z");
const expiresAt = coHostLinkExpiry(created);

describe("coHostLinkExpiry", () => {
  it("is seven days after the link was made", () => {
    expect(expiresAt).toEqual(new Date("2026-10-14T10:00:00Z"));
  });
});

describe("coHostLinkState", () => {
  const fresh = { usedAt: null, revokedAt: null, expiresAt };

  it("is pending until it is used, revoked, or runs out", () => {
    expect(coHostLinkState(fresh, created)).toBe("pending");
    expect(coHostLinkState(fresh, new Date(expiresAt.getTime() - 1))).toBe("pending");
  });

  it("expires at the end of its seven days", () => {
    expect(coHostLinkState(fresh, expiresAt)).toBe("expired");
    expect(coHostLinkState(fresh, new Date(expiresAt.getTime() + 30 * DAY))).toBe("expired");
  });

  it("works once: used, it stays used, however long ago", () => {
    const used = { ...fresh, usedAt: new Date(created.getTime() + DAY) };
    expect(coHostLinkState(used, new Date(created.getTime() + 2 * DAY))).toBe("used");
    expect(coHostLinkState(used, new Date(expiresAt.getTime() + DAY))).toBe("used");
  });

  it("is revoked once the host has revoked it, even after it would have expired", () => {
    const revoked = { ...fresh, revokedAt: new Date(created.getTime() + DAY) };
    expect(coHostLinkState(revoked, created)).toBe("revoked");
    expect(coHostLinkState(revoked, new Date(expiresAt.getTime() + DAY))).toBe("revoked");
  });
});

describe("roomForCoHost", () => {
  it("takes co-hosts up to ten, and no more", () => {
    expect(MAX_CO_HOSTS).toBe(10);
    expect(roomForCoHost(0)).toBe(true);
    expect(roomForCoHost(9)).toBe(true);
    expect(roomForCoHost(10)).toBe(false);
    expect(roomForCoHost(11)).toBe(false);
  });
});

describe("the token", () => {
  it("is random and URL-safe, and only its hash is kept", () => {
    const token = generateCoHostLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(generateCoHostLinkToken()).not.toBe(token);
    expect(hashCoHostLinkToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCoHostLinkToken(token)).toBe(hashCoHostLinkToken(token));
    expect(hashCoHostLinkToken(token)).not.toContain(token);
  });
});
