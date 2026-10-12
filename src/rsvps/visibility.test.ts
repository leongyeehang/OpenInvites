import { describe, expect, it } from "vitest";
import { guestListView } from "./visibility";

// Someone who has not replied, and guests whose replies stand each way with the host.
const visitor = {};
const approved = { rsvp: { approval: "approved" } } as const;
const pending = { rsvp: { approval: "pending" } } as const;
const declined = { rsvp: { approval: "declined" } } as const;

describe("guestListView", () => {
  it("shows the list to everyone when the host chose always", () => {
    expect(guestListView("always", visitor)).toBe("open");
    expect(guestListView("always", approved)).toBe("open");
  });

  it("shows it to nobody when the host chose hidden, however they answered", () => {
    expect(guestListView("hidden", visitor)).toBe("hidden");
    expect(guestListView("hidden", approved)).toBe("hidden");
  });

  it("makes the list a reward for answering when the host chose after you reply", () => {
    expect(guestListView("afterReply", visitor)).toBe("locked");
    expect(guestListView("afterReply", approved)).toBe("open");
  });

  it("opens nothing for a reply waiting for the host or declined by them: they see it as a visitor does", () => {
    expect(guestListView("afterReply", pending)).toBe("locked");
    expect(guestListView("afterReply", declined)).toBe("locked");
    expect(guestListView("always", pending)).toBe("open");
    expect(guestListView("always", declined)).toBe("open");
    expect(guestListView("hidden", pending)).toBe("hidden");
    expect(guestListView("hidden", declined)).toBe("hidden");
  });
});
