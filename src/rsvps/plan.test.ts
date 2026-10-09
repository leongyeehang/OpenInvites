import { describe, expect, it } from "vitest";
import type { RsvpInput } from "./form";
import { planHostEdit, planRsvp } from "./plan";

const input: RsvpInput = { status: "going", name: "Priya Nair", plusOnes: 1, plusOneNames: ["Arjun"], email: null, phone: null };
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
    expect(planRsvp("event-1", changed, mine, later)).toStrictEqual({
      replaces: mine,
      changes: { ...changed, updatedAt: later },
    });
  });

  it("takes back a stop on email once the guest gives an email again themselves", () => {
    const mine = { id: "rsvp-1", token: "the-token-they-were-given" };
    const plan = planRsvp("event-1", { ...input, email: "priya@example.com" }, mine, later);
    expect(plan.replaces && plan.changes).toMatchObject({ email: "priya@example.com", mailStoppedAt: null });
    // A blank email, or one the host does not ask for, leaves the stop where it is.
    for (const email of [null, undefined]) {
      const kept = planRsvp("event-1", { ...input, email }, mine, later);
      expect(kept.replaces && kept.changes).not.toHaveProperty("mailStoppedAt");
    }
  });
});

describe("planHostEdit", () => {
  const edit: RsvpInput = { ...input, email: "priya@example.com", phone: "+65 9123 4567" };

  it("writes everything the host's edit carries", () => {
    expect(planHostEdit(edit, { mailStoppedAt: null })).toStrictEqual(edit);
  });

  it("leaves the email alone for a guest who stopped email about the event, and writes the rest", () => {
    expect(planHostEdit(edit, { mailStoppedAt: replied })).toStrictEqual({ ...edit, email: undefined });
    expect(planHostEdit({ ...edit, email: null }, { mailStoppedAt: replied })).toStrictEqual({ ...edit, email: undefined });
  });
});
