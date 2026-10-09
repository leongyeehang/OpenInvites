import { describe, expect, it } from "vitest";
import { countsAsView } from "./views";

const guest = (over: { method?: string; headers?: Record<string, string>; state?: "draft" | "published" | "cancelled"; isHost?: boolean } = {}) =>
  countsAsView(
    { method: over.method ?? "GET", headers: new Headers(over.headers) },
    { state: over.state ?? "published" },
    { isHost: over.isHost ?? false },
  );

describe("countsAsView", () => {
  it("counts a guest opening a published event page", () => {
    expect(guest()).toBe(true);
  });

  it("counts a head request and a cancelled event, whose page stays up", () => {
    expect(guest({ method: "HEAD" })).toBe(true);
    expect(guest({ state: "cancelled" })).toBe(true);
  });

  it("does not count a draft, which a guest sees as the not-ready page", () => {
    expect(guest({ state: "draft" })).toBe(false);
  });

  it("does not count a host of the event", () => {
    expect(guest({ isHost: true })).toBe(false);
  });

  it("does not count a server action redraw", () => {
    expect(guest({ method: "POST", headers: { "next-action": "abc" } })).toBe(false);
    expect(guest({ method: "POST" })).toBe(false);
  });

  it("does not count a client-side navigation, which asks for the page's data", () => {
    expect(guest({ headers: { rsc: "1" } })).toBe(false);
  });

  it("does not count a prefetch", () => {
    expect(guest({ headers: { "next-router-prefetch": "1" } })).toBe(false);
    expect(guest({ headers: { purpose: "prefetch" } })).toBe(false);
    expect(guest({ headers: { "sec-purpose": "prefetch" } })).toBe(false);
    expect(guest({ headers: { "sec-purpose": "prefetch;anonymous-client-ip" } })).toBe(false);
  });
});
