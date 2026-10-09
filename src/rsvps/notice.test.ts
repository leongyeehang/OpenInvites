import { describe, expect, it } from "vitest";
import { rsvpNotice } from "./notice";

describe("rsvpNotice", () => {
  it("tells the hosts when a guest replies for the first time, whatever they answer", () => {
    expect(rsvpNotice(null, "going")).toBe("replied");
    expect(rsvpNotice(null, "maybe")).toBe("replied");
    expect(rsvpNotice(null, "cant")).toBe("replied");
  });

  it("tells the hosts when the RSVP status changes", () => {
    expect(rsvpNotice("going", "maybe")).toBe("changed");
    expect(rsvpNotice("maybe", "cant")).toBe("changed");
    expect(rsvpNotice("cant", "going")).toBe("changed");
  });

  it("tells the hosts when the RSVP is removed", () => {
    expect(rsvpNotice("going", null)).toBe("removed");
    expect(rsvpNotice("cant", null)).toBe("removed");
  });

  it("says nothing about an edit that keeps the status, such as a new name or plus-ones", () => {
    expect(rsvpNotice("going", "going")).toBeNull();
    expect(rsvpNotice("maybe", "maybe")).toBeNull();
  });

  it("says nothing when there was no RSVP before or after", () => {
    expect(rsvpNotice(null, null)).toBeNull();
  });
});
