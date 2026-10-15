import { describe, expect, it } from "vitest";
import { nextAttempt } from "./retry";

const now = new Date("2027-03-06T10:00:00Z");
const minutesLater = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

describe("nextAttempt", () => {
  it("tries a failed message again after 1, 5, 15 and then 60 minutes", () => {
    expect(nextAttempt(1, now)).toEqual(minutesLater(1));
    expect(nextAttempt(2, now)).toEqual(minutesLater(5));
    expect(nextAttempt(3, now)).toEqual(minutesLater(15));
    expect(nextAttempt(4, now)).toEqual(minutesLater(60));
  });

  it("gives up after the fifth failure", () => {
    expect(nextAttempt(5, now)).toBeNull();
  });
});
