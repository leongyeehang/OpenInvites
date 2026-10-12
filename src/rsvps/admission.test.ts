import { describe, expect, it } from "vitest";
import { admit, hostStatus, isFull, waitlistedSince, type AdmissionInput } from "./admission";

// An event with room for ten, of whom six are already counted, and a guest coming alone who has
// not replied before. Approval and personal invites change nothing yet (ticket 07 makes them real).
const base: AdmissionInput = { approvalRequired: false, capacity: 10, headcount: 6, invited: false, wanted: "going", party: 1 };
const going = { status: "going", approval: "approved", party: 2 } as const;
const waitlisted = { status: "waitlisted", approval: "approved", party: 2 } as const;
const maybe = { status: "maybe", approval: "approved", party: 2 } as const;
const cant = { status: "cant", approval: "approved", party: 1 } as const;

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
    // Approval and invites are taken and change nothing yet.
    ["Going, approval on", { approvalRequired: true }, { status: "going", approval: "approved" }],
    ["Going, invited, at capacity", { invited: true, headcount: 10 }, { status: "waitlisted", approval: "approved" }],
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
