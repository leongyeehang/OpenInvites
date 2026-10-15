import { describe, expect, it } from "vitest";
import { admit, hostStatus, isFull, promotedSince, waitlistedSince, type AdmissionInput } from "./admission";

// An event with room for ten, of whom six are already counted, that does not ask for approval, and
// a guest coming alone, through the event link, who has not replied before.
const base: AdmissionInput = { approvalRequired: false, capacity: 10, headcount: 6, invited: false, wanted: "going", party: 1 };
const going = { status: "going", approval: "approved", party: 2 } as const;
const waitlisted = { status: "waitlisted", approval: "approved", party: 2 } as const;
const maybe = { status: "maybe", approval: "approved", party: 2 } as const;
const cant = { status: "cant", approval: "approved", party: 1 } as const;
// Replies the host has not let onto the list: one waiting for them, and one they declined.
const pendingGoing = { status: "going", approval: "pending", party: 2 } as const;
const pendingMaybe = { status: "maybe", approval: "pending", party: 2 } as const;
const declinedGoing = { status: "going", approval: "declined", party: 2 } as const;
const declinedCant = { status: "cant", approval: "declined", party: 1 } as const;

describe("admit", () => {
  const cases: [string, Partial<AdmissionInput>, ReturnType<typeof admit>][] = [
    // Maybe and Can't go take no place, so they are saved as asked, however full the event is.
    ["Maybe, with room", { wanted: "maybe" }, { status: "maybe", approval: "approved" }],
    ["Maybe, at capacity", { wanted: "maybe", headcount: 10, party: 3 }, { status: "maybe", approval: "approved" }],
    ["Can't go, at capacity", { wanted: "cant", headcount: 10 }, { status: "cant", approval: "approved" }],
    ["Can't go, from the waitlist", { wanted: "cant", headcount: 10, current: waitlisted }, { status: "cant", approval: "approved" }],
    ["Maybe, from the waitlist", { wanted: "maybe", headcount: 10, current: waitlisted }, { status: "maybe", approval: "approved" }],
    // Without a capacity every Going reply is Going.
    ["Going, no capacity", { capacity: null, headcount: 5000, party: 11 }, { status: "going", approval: "approved" }],
    ["Going from the waitlist, no capacity", { capacity: null, current: waitlisted }, { status: "going", approval: "approved" }],
    // A new reply, or one from Maybe or Can't go: the whole party fits, or the whole party waits.
    ["Going, with room", {}, { status: "going", approval: "approved" }],
    ["Going, exactly filling it", { party: 4 }, { status: "going", approval: "approved" }],
    ["Going, one too many", { party: 5 }, { status: "waitlisted", approval: "approved" }],
    ["Going, at capacity", { headcount: 10 }, { status: "waitlisted", approval: "approved" }],
    ["Going, past capacity", { headcount: 12 }, { status: "waitlisted", approval: "approved" }],
    ["Going from Maybe, with room", { party: 2, current: maybe }, { status: "going", approval: "approved" }],
    ["Going from Maybe, too many", { party: 5, current: maybe }, { status: "waitlisted", approval: "approved" }],
    ["Going from Can't go, at capacity", { headcount: 10, current: cant }, { status: "waitlisted", approval: "approved" }],
    // A Going guest keeps their place. Raising their plus-ones beyond the room left is refused,
    // with the places their party may have (the room left beside everyone else).
    ["Going, again, the same party", { party: 2, current: going }, { status: "going", approval: "approved" }],
    ["Going, again, one more that fits", { party: 4, current: going }, { status: "going", approval: "approved" }],
    ["Going, again, raised past capacity", { party: 5, current: going }, { refused: "capacityFull", placesLeft: 4 }],
    ["Going, again, raised when nothing is left", { headcount: 9, party: 2, current: { ...going, party: 1 } }, { refused: "capacityFull", placesLeft: 1 }],
    // A capacity lowered below the headcount moves nobody: a Going guest who changes their name,
    // or brings fewer, keeps their place; one who brings more is told no place is left.
    ["Going, again, over a lowered capacity", { capacity: 5, headcount: 8, party: 2, current: going }, { status: "going", approval: "approved" }],
    ["Going, again, bringing fewer over it", { capacity: 5, headcount: 8, party: 1, current: going }, { status: "going", approval: "approved" }],
    ["Going, again, bringing more over it", { capacity: 5, headcount: 8, party: 3, current: going }, { refused: "capacityFull", placesLeft: 0 }],
    // A waitlisted guest asking for Going again waits: promotion decides, in order.
    ["Going from the waitlist, with room", { headcount: 0, current: waitlisted }, { status: "waitlisted", approval: "approved" }],
    ["Going from the waitlist, at capacity", { headcount: 10, current: waitlisted }, { status: "waitlisted", approval: "approved" }],
    // With approval on, a new reply waits for the host with the status it asked for, whatever the
    // capacity: it takes no place and waits for none until the host approves it.
    ["Going, approval on", { approvalRequired: true }, { status: "going", approval: "pending" }],
    ["Going, approval on, at capacity", { approvalRequired: true, headcount: 10, party: 3 }, { status: "going", approval: "pending" }],
    ["Going, approval on, no capacity", { approvalRequired: true, capacity: null }, { status: "going", approval: "pending" }],
    ["Maybe, approval on", { approvalRequired: true, wanted: "maybe" }, { status: "maybe", approval: "pending" }],
    ["Can't go, approval on", { approvalRequired: true, wanted: "cant" }, { status: "cant", approval: "pending" }],
    // A reply through a personal invite, which the host issued, is approved, and capacity applies
    // to it as to any reply.
    ["Going, invited, approval on", { approvalRequired: true, invited: true }, { status: "going", approval: "approved" }],
    ["Going, invited, approval on, at capacity", { approvalRequired: true, invited: true, headcount: 10 }, { status: "waitlisted", approval: "approved" }],
    ["Maybe, invited, approval on", { approvalRequired: true, invited: true, wanted: "maybe" }, { status: "maybe", approval: "approved" }],
    ["Going, invited, at capacity", { invited: true, headcount: 10 }, { status: "waitlisted", approval: "approved" }],
    // A pending reply stays pending when the guest changes it, as they ask, however the setting
    // stands now and however full the event is: it holds no place, so bringing more is not refused.
    ["Going, again, pending", { approvalRequired: true, party: 2, current: pendingGoing }, { status: "going", approval: "pending" }],
    ["Going, again, pending, raised past capacity", { approvalRequired: true, party: 5, current: pendingGoing }, { status: "going", approval: "pending" }],
    ["Going, again, pending, at capacity", { approvalRequired: true, headcount: 10, current: pendingGoing }, { status: "going", approval: "pending" }],
    ["Going from Maybe, pending, at capacity", { approvalRequired: true, headcount: 10, current: pendingMaybe }, { status: "going", approval: "pending" }],
    ["Maybe from Going, pending", { approvalRequired: true, wanted: "maybe", current: pendingGoing }, { status: "maybe", approval: "pending" }],
    ["Going, again, pending, approval off", { party: 5, current: pendingGoing }, { status: "going", approval: "pending" }],
    // A declined reply stays declined, as the guest changes it; only the host approves it.
    ["Going, again, declined", { approvalRequired: true, party: 2, current: declinedGoing }, { status: "going", approval: "declined" }],
    ["Going, again, declined, raised past capacity", { approvalRequired: true, party: 5, current: declinedGoing }, { status: "going", approval: "declined" }],
    ["Going from Can't go, declined, at capacity", { approvalRequired: true, headcount: 10, current: declinedCant }, { status: "going", approval: "declined" }],
    ["Can't go, declined", { approvalRequired: true, wanted: "cant", current: declinedGoing }, { status: "cant", approval: "declined" }],
    ["Going, again, declined, approval off", { current: declinedGoing }, { status: "going", approval: "declined" }],
    // An approved reply is admitted as without approval: turning approval on changes no reply.
    ["Going, again, approved, approval on", { approvalRequired: true, party: 2, current: going }, { status: "going", approval: "approved" }],
    ["Going, again, approved, approval on, raised past capacity", { approvalRequired: true, party: 5, current: going }, { refused: "capacityFull", placesLeft: 4 }],
    ["Going from Maybe, approved, approval on, too many", { approvalRequired: true, party: 5, current: maybe }, { status: "waitlisted", approval: "approved" }],
    ["Going from the waitlist, approval on", { approvalRequired: true, headcount: 0, current: waitlisted }, { status: "waitlisted", approval: "approved" }],
    ["Can't go, approved, approval on", { approvalRequired: true, wanted: "cant", current: going }, { status: "cant", approval: "approved" }],
  ];

  it.each(cases)("%s", (_, given, admitted) => {
    expect(admit({ ...base, ...given })).toStrictEqual(admitted);
  });
});

describe("isFull", () => {
  it("is full once the headcount has reached the capacity, so not even one more fits", () => {
    expect(isFull(10, 9)).toBe(false);
    expect(isFull(10, 10)).toBe(true);
    expect(isFull(10, 12)).toBe(true);
  });

  it("is never full without a capacity", () => {
    expect(isFull(null, 5000)).toBe(false);
  });
});

describe("waitlistedSince", () => {
  const then = new Date("2027-03-01T10:00:00Z");
  const now = new Date("2027-03-04T21:30:00Z");

  it("starts the wait now for a reply that joins the waitlist", () => {
    expect(waitlistedSince("waitlisted", undefined, now)).toEqual(now);
    expect(waitlistedSince("waitlisted", { status: "maybe", waitlistedAt: null }, now)).toEqual(now);
  });

  it("keeps the place of a reply that stays on it", () => {
    expect(waitlistedSince("waitlisted", { status: "waitlisted", waitlistedAt: then }, now)).toEqual(then);
  });

  it("ends the wait for a reply that leaves it, or was never on it", () => {
    expect(waitlistedSince("maybe", { status: "waitlisted", waitlistedAt: then }, now)).toBeNull();
    expect(waitlistedSince("going", { status: "waitlisted", waitlistedAt: then }, now)).toBeNull();
    expect(waitlistedSince("going", undefined, now)).toBeNull();
  });
});

describe("promotedSince", () => {
  const then = new Date("2027-03-01T10:00:00Z");

  it("keeps the mark of a promoted reply that stays Going", () => {
    expect(promotedSince("going", { promotedAt: then })).toEqual(then);
  });

  it("takes the mark off a reply that leaves Going", () => {
    expect(promotedSince("maybe", { promotedAt: then })).toBeNull();
    expect(promotedSince("cant", { promotedAt: then })).toBeNull();
    expect(promotedSince("waitlisted", { promotedAt: then })).toBeNull();
  });

  it("leaves a reply that was never promoted without one", () => {
    expect(promotedSince("going", { promotedAt: null })).toBeNull();
    expect(promotedSince("going", undefined)).toBeNull();
    expect(promotedSince("maybe", undefined)).toBeNull();
  });
});

describe("hostStatus", () => {
  it("sets the status the host chose, whatever the capacity", () => {
    expect(hostStatus("going", "maybe")).toBe("going");
    expect(hostStatus("maybe", "going")).toBe("maybe");
    expect(hostStatus("cant", "waitlisted")).toBe("cant");
    expect(hostStatus("maybe", "waitlisted")).toBe("maybe");
  });

  it("keeps a waitlisted guest waiting when the host saves them as Going, which they asked for", () => {
    expect(hostStatus("going", "waitlisted")).toBe("waitlisted");
  });
});
