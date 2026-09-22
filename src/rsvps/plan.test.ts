import { describe, expect, it } from "vitest";
import type { RsvpInput } from "./form";
import { planRsvp } from "./plan";

const input: RsvpInput = { status: "going", name: "Priya Nair", plusOnes: 1, plusOneNames: ["Arjun"], email: null };
const replied = new Date("2027-03-01T10:00:00Z");
const later = new Date("2027-03-04T21:30:00Z");

describe("planRsvp", () => {
  it("starts an RSVP for a guest who has not replied to this event before", () => {
    expect(planRsvp("event-1", input, undefined, replied)).toEqual({
      replaces: null,
      rsvp: { ...input, eventId: "event-1", repliedAt: replied, updatedAt: replied },
    });
  });

  it("replaces the RSVP the guest already owns, keeping its edit token and the time they first replied", () => {
    const changed: RsvpInput = { ...input, status: "cant", plusOnes: 0, plusOneNames: [] };
    const mine = { id: "rsvp-1", token: "the-token-they-were-given" };
    expect(planRsvp("event-1", changed, mine, later)).toEqual({
      replaces: mine,
      changes: { ...changed, updatedAt: later },
    });
  });
});
