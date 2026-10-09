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
    const mine = { id: "rsvp-1", token: "the-token-they-were-given", email: null };
    expect(planRsvp("event-1", changed, mine, later)).toStrictEqual({
      replaces: { id: "rsvp-1", token: "the-token-they-were-given" },
      changes: { ...changed, updatedAt: later },
    });
  });

  it("takes back a stop on email once the guest gives an email again themselves", () => {
    const mine = { id: "rsvp-1", token: "the-token-they-were-given", email: null };
    const plan = planRsvp("event-1", { ...input, email: "priya@example.com" }, mine, later);
    expect(plan.replaces && plan.changes).toMatchObject({ email: "priya@example.com", mailStoppedAt: null });
    // A blank email, or one the host does not ask for, leaves the stop where it is.
    for (const email of [null, undefined]) {
      const kept = planRsvp("event-1", { ...input, email }, mine, later);
      expect(kept.replaces && kept.changes).not.toHaveProperty("mailStoppedAt");
    }
  });

  it("marks the email proven when the guest has just entered its code, new or returning", () => {
    const withEmail: RsvpInput = { ...input, email: "priya@example.com" };
    const fresh = planRsvp("event-1", withEmail, undefined, replied, true);
    expect(fresh.replaces === null && fresh.rsvp).toMatchObject({ email: "priya@example.com", emailVerifiedAt: replied });
    const mine = { id: "rsvp-1", token: "the-token-they-were-given", email: "priya@example.org" };
    const changed = planRsvp("event-1", withEmail, mine, later, true);
    expect(changed.replaces && changed.changes).toMatchObject({ email: "priya@example.com", emailVerifiedAt: later });
  });

  it("keeps the mark while the email stays the same, and drops it with an email changed or blanked without a code", () => {
    const mine = { id: "rsvp-1", token: "the-token-they-were-given", email: "priya@example.com" };
    const kept = planRsvp("event-1", { ...input, status: "maybe", email: "priya@example.com" }, mine, later);
    expect(kept.replaces && kept.changes).not.toHaveProperty("emailVerifiedAt");
    // A form that asks for no email leaves the stored one, and its mark, alone.
    const unasked = planRsvp("event-1", { ...input, email: undefined }, mine, later);
    expect(unasked.replaces && unasked.changes).not.toHaveProperty("emailVerifiedAt");
    for (const email of ["priya@example.org", null]) {
      const dropped = planRsvp("event-1", { ...input, email }, mine, later);
      expect(dropped.replaces && dropped.changes).toMatchObject({ emailVerifiedAt: null });
    }
    // A new guest's email is not proven until a code says so.
    const fresh = planRsvp("event-1", { ...input, email: "priya@example.com" }, undefined, replied);
    expect(fresh.replaces === null && fresh.rsvp).not.toHaveProperty("emailVerifiedAt");
  });
});

describe("planHostEdit", () => {
  const edit: RsvpInput = { ...input, email: "priya@example.com", phone: "+65 9123 4567" };

  it("writes everything the host's edit carries", () => {
    expect(planHostEdit(edit, { mailStoppedAt: null, email: "priya@example.com" })).toStrictEqual(edit);
  });

  it("leaves the email alone for a guest who stopped email about the event, and writes the rest", () => {
    expect(planHostEdit(edit, { mailStoppedAt: replied, email: null })).toStrictEqual({ ...edit, email: undefined });
    expect(planHostEdit({ ...edit, email: null }, { mailStoppedAt: replied, email: null })).toStrictEqual({ ...edit, email: undefined });
  });

  it("takes the proof away from an email the host changes or blanks, as only a code proves one", () => {
    expect(planHostEdit(edit, { mailStoppedAt: null, email: "priya@example.org" })).toStrictEqual({ ...edit, emailVerifiedAt: null });
    expect(planHostEdit({ ...edit, email: null }, { mailStoppedAt: null, email: "priya@example.com" })).toStrictEqual({
      ...edit,
      email: null,
      emailVerifiedAt: null,
    });
  });
});
