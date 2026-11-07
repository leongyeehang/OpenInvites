import { describe, expect, it } from "vitest";
import { acceptsRsvps, eventPageFor } from "./access";

const open = { inviteOnly: false };
const closed = { inviteOnly: true };
const visitor = { isHost: false, admitted: false };
const invited = { isHost: false, admitted: true };
const host = { isHost: true, admitted: false };

describe("eventPageFor", () => {
  it("keeps a draft to its host", () => {
    expect(eventPageFor({ state: "draft", ...open }, visitor)).toBe("notReady");
    expect(eventPageFor({ state: "draft", ...open }, host)).toBe("invitation");
  });

  it("shows a published event to anyone with the link", () => {
    expect(eventPageFor({ state: "published", ...open }, visitor)).toBe("invitation");
  });

  it("keeps a cancelled event's page up, so guests learn the news instead of finding nothing", () => {
    expect(eventPageFor({ state: "cancelled", ...open }, visitor)).toBe("invitation");
  });

  it("locks an invite-only event to anyone not in, and opens it to the invited and the hosts", () => {
    expect(eventPageFor({ state: "published", ...closed }, visitor)).toBe("locked");
    expect(eventPageFor({ state: "published", ...closed }, invited)).toBe("invitation");
    expect(eventPageFor({ state: "published", ...closed }, host)).toBe("invitation");
  });

  it("says an invite-only draft is not ready before it says it is locked, even to the invited", () => {
    expect(eventPageFor({ state: "draft", ...closed }, visitor)).toBe("notReady");
    expect(eventPageFor({ state: "draft", ...closed }, invited)).toBe("notReady");
    expect(eventPageFor({ state: "draft", ...closed }, host)).toBe("invitation");
  });

  it("shows a cancelled invite-only event's notice only to those in", () => {
    expect(eventPageFor({ state: "cancelled", ...closed }, visitor)).toBe("locked");
    expect(eventPageFor({ state: "cancelled", ...closed }, invited)).toBe("invitation");
    expect(eventPageFor({ state: "cancelled", ...closed }, host)).toBe("invitation");
  });
});

describe("acceptsRsvps", () => {
  it("takes answers only while an event is published", () => {
    expect(acceptsRsvps("published")).toBe(true);
    expect(acceptsRsvps("draft")).toBe(false);
    expect(acceptsRsvps("cancelled")).toBe(false);
  });
});
