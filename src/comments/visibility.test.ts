import { describe, expect, it } from "vitest";
import { commentsView, takesComments } from "./visibility";

const host = { kind: "host" } as const;
const guest = { kind: "guest", rsvpId: "rsvp-priya" } as const;
const visitor = { kind: "visitor" } as const;

describe("commentsView", () => {
  it("opens the comments to the hosts and to a guest who has replied on this device", () => {
    expect(commentsView(host)).toBe("open");
    expect(commentsView(guest)).toBe("open");
  });

  it("locks them for anyone who has not replied", () => {
    expect(commentsView(visitor)).toBe("locked");
  });
});

describe("takesComments", () => {
  const published = { state: "published", commentsEnabled: true } as const;

  it("takes a comment from the hosts and from a guest who has replied", () => {
    expect(takesComments(published, host)).toBe(true);
    expect(takesComments(published, guest)).toBe(true);
  });

  it("takes none from someone who has not replied", () => {
    expect(takesComments(published, visitor)).toBe(false);
  });

  it("takes none once the host has turned comments off", () => {
    expect(takesComments({ ...published, commentsEnabled: false }, host)).toBe(false);
    expect(takesComments({ ...published, commentsEnabled: false }, guest)).toBe(false);
  });

  it("takes none on a cancelled event, whose comments stay to be read", () => {
    expect(takesComments({ ...published, state: "cancelled" }, host)).toBe(false);
    expect(takesComments({ ...published, state: "cancelled" }, guest)).toBe(false);
  });

  it("takes the hosts' on a draft, which only they can see", () => {
    expect(takesComments({ ...published, state: "draft" }, host)).toBe(true);
    expect(takesComments({ ...published, state: "draft" }, guest)).toBe(false);
  });
});
