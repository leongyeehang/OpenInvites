import { describe, expect, it } from "vitest";
import { missingToPublish } from "./publish";

const DATE = new Date("2027-03-06T11:00:00Z");

describe("what a draft lacks before it is published", () => {
  it("is a title first, then a date", () => {
    expect(missingToPublish({ title: "", startsAt: null })).toBe("title");
    expect(missingToPublish({ title: "   ", startsAt: DATE })).toBe("title");
    expect(missingToPublish({ title: "Ada’s birthday", startsAt: null })).toBe("date");
  });

  it("is nothing once it has both", () => {
    expect(missingToPublish({ title: "Ada’s birthday", startsAt: DATE })).toBeUndefined();
  });
});
