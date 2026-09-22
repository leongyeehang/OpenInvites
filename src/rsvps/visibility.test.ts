import { describe, expect, it } from "vitest";
import { guestListView } from "./visibility";

describe("guestListView", () => {
  it("shows the list to everyone when the host chose always", () => {
    expect(guestListView("always", { hasRsvp: false })).toBe("open");
    expect(guestListView("always", { hasRsvp: true })).toBe("open");
  });

  it("shows it to nobody when the host chose hidden, however they answered", () => {
    expect(guestListView("hidden", { hasRsvp: false })).toBe("hidden");
    expect(guestListView("hidden", { hasRsvp: true })).toBe("hidden");
  });

  it("makes the list a reward for answering when the host chose after you reply", () => {
    expect(guestListView("afterReply", { hasRsvp: false })).toBe("locked");
    expect(guestListView("afterReply", { hasRsvp: true })).toBe("open");
  });
});
