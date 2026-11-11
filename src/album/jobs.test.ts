import { afterEach, describe, expect, it, vi } from "vitest";
import { claimable, crashedOut, exhausted, keepLease, LEASE_MS, leaseLost, MAX_TRIES, processorOf, RENEW_MS } from "./jobs";
import { VIDEO_WORKS } from "./video";

// The processing queue's lease (M7 ticket 06; ten minutes since M8 ticket 04): a job is claimable
// when nobody holds it, or when the holder's lease is ten minutes old, which a crashed processor
// leaves behind; three tries in all.
describe("claimable", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("is true for a job nobody holds, and for one whose lease is ten minutes old", () => {
    expect(LEASE_MS).toBe(10 * 60_000);
    expect(claimable({ leasedAt: null }, now)).toBe(true);
    expect(claimable({ leasedAt: ago(10 * 60_000) }, now)).toBe(true);
  });

  it("is false while a lease is fresh", () => {
    expect(claimable({ leasedAt: ago(1000) }, now)).toBe(false);
    expect(claimable({ leasedAt: ago(9 * 60_000 + 59_000) }, now)).toBe(false);
  });
});

// A lease no renewal has reached for ten minutes is lost (M8 ticket 05): another processor may
// claim the job by then, so this one stops.
describe("leaseLost", () => {
  const renewedAt = new Date("2026-11-09T12:00:00Z");
  const later = (ms: number) => new Date(renewedAt.getTime() + ms);

  it("is true once a whole lease has passed since the last renewal, and not before", () => {
    expect(leaseLost(renewedAt, later(LEASE_MS - 1))).toBe(false);
    expect(leaseLost(renewedAt, later(LEASE_MS))).toBe(true);
    expect(leaseLost(renewedAt, later(LEASE_MS + 60_000))).toBe(true);
  });
});

// Renewing a lease while a job runs (M8 ticket 04): every two minutes; a renewal that finds the
// job gone is a loss, and one that fails is not, until none has succeeded for a whole lease.
describe("keepLease", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renews every two minutes", async () => {
    vi.useFakeTimers();
    expect(RENEW_MS).toBe(2 * 60_000);
    const renew = vi.fn(async () => true);
    const onLost = vi.fn();
    const stop = keepLease(renew, onLost);
    await vi.advanceTimersByTimeAsync(6 * 60_000);
    expect(renew).toHaveBeenCalledTimes(3);
    expect(onLost).not.toHaveBeenCalled();
    stop();
  });

  it("calls onLost once when a renewal finds the job gone, and renews no more", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => false);
    const onLost = vi.fn();
    const stop = keepLease(renew, onLost);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(onLost).toHaveBeenCalledTimes(1);
    stop();
  });

  it("logs a renewal that throws, and renews again", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const renew = vi.fn().mockRejectedValueOnce(new Error("connection reset")).mockResolvedValue(true);
    const onLost = vi.fn();
    const stop = keepLease(renew, onLost);
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0])).toContain("connection reset");
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(renew).toHaveBeenCalledTimes(2);
    expect(onLost).not.toHaveBeenCalled();
    stop();
  });

  it("calls onLost once when no renewal has succeeded for ten minutes, and renews no more", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const renew = vi.fn().mockResolvedValueOnce(true).mockRejectedValue(new Error("connection refused"));
    const onLost = vi.fn();
    const stop = keepLease(renew, onLost);
    // Renewed at two minutes, then out of reach: lost ten minutes after that renewal.
    await vi.advanceTimersByTimeAsync(LEASE_MS + RENEW_MS - 1);
    expect(onLost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(renew).toHaveBeenCalledTimes(5);
    expect(error).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(LEASE_MS);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(renew).toHaveBeenCalledTimes(5);
    stop();
  });

  it("renews no more once stopped", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => true);
    const stop = keepLease(renew, vi.fn());
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    stop();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(renew).toHaveBeenCalledTimes(1);
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

// A claim counts a try; a job claimed more times than there are tries was never given back by a
// try that ended, so the processor died on it each time, and it is failed rather than tried again.
describe("crashedOut", () => {
  it("is true only once a job has been claimed more times than there are tries", () => {
    expect(crashedOut({ attempts: 3 })).toBe(false);
    expect(crashedOut({ attempts: 4 })).toBe(true);
  });
});

// Who takes a claimed job, by its work (M8 ticket 04): a `motion` job has nobody until ticket 08,
// so one met before then is dropped and logged, never processed as a clip.
describe("processorOf", () => {
  it("sends a clip to processing, a sizes job to the sizes, and a motion job to nobody yet", () => {
    expect(VIDEO_WORKS.map(processorOf)).toEqual(["clip", "sizes", undefined]);
  });
});
