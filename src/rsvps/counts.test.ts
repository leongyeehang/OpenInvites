import { describe, expect, it } from "vitest";
import { countRsvps } from "./counts";

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
