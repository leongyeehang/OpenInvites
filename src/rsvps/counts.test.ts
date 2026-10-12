import { describe, expect, it } from "vitest";
import { countRsvps, groupByStatus } from "./counts";

describe("countRsvps", () => {
  it("counts every status, and the headcount from Going guests and the people they bring", () => {
    // Three going who bring four between them; two maybes bringing five; one who can't come; two
    // waiting for a place with three between them, who are not expected yet.
    expect(
      countRsvps([
        { status: "going", approval: "approved", rsvps: 3, plusOnes: 4 },
        { status: "maybe", approval: "approved", rsvps: 2, plusOnes: 5 },
        { status: "cant", approval: "approved", rsvps: 1, plusOnes: 0 },
        { status: "waitlisted", approval: "approved", rsvps: 2, plusOnes: 3 },
      ]),
    ).toEqual({ going: 3, maybe: 2, cant: 1, waitlisted: 2, pending: 0, declined: 0, headcount: 7 });
  });

  it("counts the replies waiting for the host's approval, and those declined, apart: none of them is expected", () => {
    // One Going guest bringing one, approved; two Going and one Maybe waiting for the host; one
    // Going guest the host declined.
    expect(
      countRsvps([
        { status: "going", approval: "approved", rsvps: 1, plusOnes: 1 },
        { status: "going", approval: "pending", rsvps: 2, plusOnes: 3 },
        { status: "maybe", approval: "pending", rsvps: 1, plusOnes: 0 },
        { status: "going", approval: "declined", rsvps: 1, plusOnes: 2 },
      ]),
    ).toEqual({ going: 1, maybe: 0, cant: 0, waitlisted: 0, pending: 3, declined: 1, headcount: 2 });
  });

  it("counts nobody when nobody has replied", () => {
    expect(countRsvps([])).toEqual({ going: 0, maybe: 0, cant: 0, waitlisted: 0, pending: 0, declined: 0, headcount: 0 });
  });
});

describe("groupByStatus", () => {
  const priya = { status: "going", approval: "approved", plusOnes: 1, name: "Priya Nair" } as const;
  const arjun = { status: "going", approval: "approved", plusOnes: 0, name: "Arjun Rao" } as const;
  const mei = { status: "cant", approval: "approved", plusOnes: 0, name: "Mei Lin" } as const;
  const sam = { status: "waitlisted", approval: "approved", plusOnes: 2, name: "Sam Okafor" } as const;
  const chen = { status: "going", approval: "pending", plusOnes: 0, name: "Chen Wei" } as const;
  const bea = { status: "maybe", approval: "pending", plusOnes: 0, name: "Bea Lim" } as const;
  const omar = { status: "going", approval: "declined", plusOnes: 1, name: "Omar Haddad" } as const;

  it("returns every group: waiting for approval, Going, the waitlist, Maybe, Can't go, then declined", () => {
    // Nobody is a maybe, and that group still comes back so the host sees the empty column.
    expect(groupByStatus([mei, omar, sam, chen, priya, bea, arjun])).toEqual([
      { group: "pending", rsvps: [chen, bea] },
      { group: "going", rsvps: [priya, arjun] },
      { group: "waitlisted", rsvps: [sam] },
      { group: "maybe", rsvps: [] },
      { group: "cant", rsvps: [mei] },
      { group: "declined", rsvps: [omar] },
    ]);
  });

  it("keeps guests in the order they arrived within a group", () => {
    const [, going] = groupByStatus([arjun, priya]);
    expect(going.rsvps).toEqual([arjun, priya]);
  });
});
