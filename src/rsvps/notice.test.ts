import { describe, expect, it } from "vitest";
import type { Approval } from "./admission";
import type { SavedStatus } from "./form";
import { rsvpNotice } from "./notice";

// An RSVP the host has let onto the list, as every RSVP is on an event without approval; one
// waiting for their approval; one they declined.
const approved = (status: SavedStatus) => ({ status, approval: "approved" as Approval });
const pending = (status: SavedStatus) => ({ status, approval: "pending" as Approval });
const declined = (status: SavedStatus) => ({ status, approval: "declined" as Approval });

describe("rsvpNotice", () => {
  it("tells the hosts when a guest replies for the first time, whatever they answer", () => {
    expect(rsvpNotice(null, approved("going"))).toBe("replied");
    expect(rsvpNotice(null, approved("maybe"))).toBe("replied");
    expect(rsvpNotice(null, approved("cant"))).toBe("replied");
  });

  it("tells the hosts when a first reply waits for their approval, whatever it answers", () => {
    expect(rsvpNotice(null, pending("going"))).toBe("pending");
    expect(rsvpNotice(null, pending("maybe"))).toBe("pending");
    expect(rsvpNotice(null, pending("cant"))).toBe("pending");
  });

  it("tells the hosts when the RSVP status changes", () => {
    expect(rsvpNotice(approved("going"), approved("maybe"))).toBe("changed");
    expect(rsvpNotice(approved("maybe"), approved("cant"))).toBe("changed");
    expect(rsvpNotice(approved("cant"), approved("going"))).toBe("changed");
  });

  it("tells the hosts when a reply waiting for them changes its status, and that it still waits", () => {
    expect(rsvpNotice(pending("going"), pending("maybe"))).toBe("pendingChanged");
    expect(rsvpNotice(pending("cant"), pending("going"))).toBe("pendingChanged");
  });

  it("tells the hosts when a reply they declined changes its status", () => {
    expect(rsvpNotice(declined("cant"), declined("going"))).toBe("changed");
  });

  it("tells the hosts when a reply joins the waitlist, first time or from another status", () => {
    expect(rsvpNotice(null, approved("waitlisted"))).toBe("waitlisted");
    expect(rsvpNotice(approved("maybe"), approved("waitlisted"))).toBe("waitlisted");
    expect(rsvpNotice(approved("cant"), approved("waitlisted"))).toBe("waitlisted");
  });

  it("tells the hosts when a reply leaves the waitlist by a change, as of any change of status", () => {
    expect(rsvpNotice(approved("waitlisted"), approved("maybe"))).toBe("changed");
    expect(rsvpNotice(approved("waitlisted"), approved("going"))).toBe("changed");
    expect(rsvpNotice(approved("waitlisted"), null)).toBe("removed");
  });

  it("tells the hosts when the RSVP is removed, whether or not they had approved it", () => {
    expect(rsvpNotice(approved("going"), null)).toBe("removed");
    expect(rsvpNotice(approved("cant"), null)).toBe("removed");
    expect(rsvpNotice(pending("going"), null)).toBe("removed");
    expect(rsvpNotice(declined("maybe"), null)).toBe("removed");
  });

  it("says nothing about an edit that keeps the status, such as a new name or plus-ones", () => {
    expect(rsvpNotice(approved("going"), approved("going"))).toBeNull();
    expect(rsvpNotice(approved("maybe"), approved("maybe"))).toBeNull();
    expect(rsvpNotice(approved("waitlisted"), approved("waitlisted"))).toBeNull();
    expect(rsvpNotice(pending("going"), pending("going"))).toBeNull();
    expect(rsvpNotice(declined("going"), declined("going"))).toBeNull();
  });

  it("says nothing when there was no RSVP before or after", () => {
    expect(rsvpNotice(null, null)).toBeNull();
  });
});
