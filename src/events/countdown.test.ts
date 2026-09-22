import { describe, expect, it } from "vitest";
import { countdownFor } from "./countdown";

const party = {
  startsAt: new Date("2027-03-06T11:00:00Z"),
  endsAt: new Date("2027-03-06T14:00:00Z"),
  allDay: false,
  timeZone: "Asia/Singapore",
};

describe("countdownFor", () => {
  it("counts down in days, hours and minutes", () => {
    expect(countdownFor(party, new Date("2027-03-03T09:30:00Z"))).toEqual({
      state: "before",
      days: 3,
      hours: 1,
      minutes: 30,
    });
  });

  it("says it is happening from the moment it starts until it is over", () => {
    expect(countdownFor(party, new Date("2027-03-06T11:00:00Z"))).toEqual({ state: "now" });
    expect(countdownFor(party, new Date("2027-03-06T13:59:00Z"))).toEqual({ state: "now" });
    expect(countdownFor(party, new Date("2027-03-06T14:00:00Z"))).toEqual({ state: "ended" });
  });

  it("treats an event with no end as over once it has started", () => {
    const open = { ...party, endsAt: null };
    expect(countdownFor(open, new Date("2027-03-06T11:00:01Z"))).toEqual({ state: "ended" });
  });

  it("lets an all-day event run to the end of its day, wherever that day is", () => {
    const beach = { startsAt: new Date("2027-04-09T16:00:00Z"), endsAt: null, allDay: true, timeZone: "Asia/Singapore" };
    // Still the 10th in Singapore, though it is the 10th everywhere west of it too.
    expect(countdownFor(beach, new Date("2027-04-10T12:00:00Z"))).toEqual({ state: "now" });
    expect(countdownFor(beach, new Date("2027-04-10T16:00:00Z"))).toEqual({ state: "ended" });
  });
});
