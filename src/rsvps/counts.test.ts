import { describe, expect, it } from "vitest";
import { countRsvps, groupByStatus } from "./counts";

describe("countRsvps", () => {
  it("counts every status, and the headcount from Going guests and the people they bring", () => {
    // Three going who bring four between them; two maybes bringing five; one who can't come.
    expect(
      countRsvps([
        { status: "going", rsvps: 3, plusOnes: 4 },
        { status: "maybe", rsvps: 2, plusOnes: 5 },
        { status: "cant", rsvps: 1, plusOnes: 0 },
      ]),
    ).toEqual({ going: 3, maybe: 2, cant: 1, headcount: 7 });
  });

  it("counts nobody when nobody has replied", () => {
    expect(countRsvps([])).toEqual({ going: 0, maybe: 0, cant: 0, headcount: 0 });
  });
});

describe("groupByStatus", () => {
  const priya = { status: "going", plusOnes: 1, name: "Priya Nair" } as const;
  const arjun = { status: "going", plusOnes: 0, name: "Arjun Rao" } as const;
  const mei = { status: "cant", plusOnes: 0, name: "Mei Lin" } as const;

  it("returns all three groups, in the order the RSVP buttons show them", () => {
    // Nobody is a maybe, and that group still comes back so the host sees the empty column.
    expect(groupByStatus([mei, priya, arjun])).toEqual([
      { status: "going", rsvps: [priya, arjun] },
      { status: "maybe", rsvps: [] },
      { status: "cant", rsvps: [mei] },
    ]);
  });

  it("keeps guests in the order they arrived within a group", () => {
    const [going] = groupByStatus([arjun, priya]);
    expect(going.rsvps).toEqual([arjun, priya]);
  });
});
