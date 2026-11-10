import { describe, expect, it } from "vitest";
import { claimable, exhausted, LEASE_MS, MAX_TRIES } from "./jobs";

// The processing queue's lease (M7 ticket 06): a job is claimable when nobody holds it, or when
// the holder's lease is an hour old, which a crashed processor leaves behind; three tries in all.
describe("claimable", () => {
  const now = new Date("2026-11-09T12:00:00Z");

  it("is true for a job nobody holds, and for one whose lease has lapsed", () => {
    expect(claimable({ leasedAt: null }, now)).toBe(true);
    expect(claimable({ leasedAt: new Date(now.getTime() - LEASE_MS - 1) }, now)).toBe(true);
  });

  it("is false while a lease is fresh", () => {
    expect(claimable({ leasedAt: new Date(now.getTime() - 1000) }, now)).toBe(false);
    expect(claimable({ leasedAt: new Date(now.getTime() - LEASE_MS + 1) }, now)).toBe(false);
  });
});

describe("exhausted", () => {
  it("is true from the third try on", () => {
    expect(MAX_TRIES).toBe(3);
    expect(exhausted({ attempts: 1 })).toBe(false);
    expect(exhausted({ attempts: 2 })).toBe(false);
    expect(exhausted({ attempts: 3 })).toBe(true);
    expect(exhausted({ attempts: 4 })).toBe(true);
  });
});
