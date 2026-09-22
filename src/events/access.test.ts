import { describe, expect, it } from "vitest";
import { acceptsRsvps, eventPageFor } from "./access";

describe("eventPageFor", () => {
  it("keeps a draft to its host", () => {
    expect(eventPageFor("draft", { isHost: false })).toBe("notReady");
    expect(eventPageFor("draft", { isHost: true })).toBe("invitation");
  });

  it("shows a published event to anyone with the link", () => {
    expect(eventPageFor("published", { isHost: false })).toBe("invitation");
  });

  it("keeps a cancelled event's page up, so guests learn the news instead of finding nothing", () => {
    expect(eventPageFor("cancelled", { isHost: false })).toBe("invitation");
  });
});

describe("acceptsRsvps", () => {
  it("takes answers only while an event is published", () => {
    expect(acceptsRsvps("published")).toBe(true);
    expect(acceptsRsvps("draft")).toBe(false);
    expect(acceptsRsvps("cancelled")).toBe(false);
  });
});
