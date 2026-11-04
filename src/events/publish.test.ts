import { describe, expect, it } from "vitest";
import { missingToPublish } from "./publish";

const DATE = new Date("2027-03-06T11:00:00Z");
const OPENED = new Date("2027-02-01T00:00:00Z");
const NO_POLL = { pollOpenedAt: null, pollClosedAt: null };

describe("what a draft lacks before it is published", () => {
  it("is a title first, then a date", () => {
    expect(missingToPublish({ title: "", startsAt: null, ...NO_POLL })).toBe("title");
    expect(missingToPublish({ title: "   ", startsAt: DATE, ...NO_POLL })).toBe("title");
    expect(missingToPublish({ title: "Ada’s birthday", startsAt: null, ...NO_POLL })).toBe("date");
  });

  it("is nothing once it has both", () => {
    expect(missingToPublish({ title: "Ada’s birthday", startsAt: DATE, ...NO_POLL })).toBeUndefined();
  });

  it("takes an open date poll in place of the date (ticket 09)", () => {
    expect(missingToPublish({ title: "Ada’s birthday", startsAt: null, pollOpenedAt: OPENED, pollClosedAt: null })).toBeUndefined();
    expect(missingToPublish({ title: "", startsAt: null, pollOpenedAt: OPENED, pollClosedAt: null })).toBe("title");
  });
});
