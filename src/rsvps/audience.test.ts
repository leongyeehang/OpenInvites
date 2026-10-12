import { describe, expect, it } from "vitest";
import type { Approval } from "./admission";
import type { SavedStatus } from "./form";
import { recipients } from "./audience";

// A guest the host has let onto the list, as every guest is on an event without approval.
function guest(status: SavedStatus, email: string | null, mailToken: string | null = email && `token-${email}`) {
  return { status, approval: "approved" as Approval, email, mailToken };
}

describe("recipients", () => {
  it("emails the guests whose status the host picked and who gave an email", () => {
    const going = guest("going", "priya@example.test");
    const maybe = guest("maybe", "mei@example.test");
    expect(recipients([going, maybe], ["going", "maybe"])).toEqual([going, maybe]);
  });

  it("leaves out the guests whose status the host did not pick, though they gave an email", () => {
    const going = guest("going", "priya@example.test");
    expect(recipients([going, guest("maybe", "mei@example.test"), guest("cant", "arjun@example.test")], ["going"])).toEqual([going]);
  });

  it("reaches the guests who can't go only when the host picks them", () => {
    const cant = guest("cant", "arjun@example.test");
    expect(recipients([cant], ["going", "maybe"])).toEqual([]);
    expect(recipients([cant], ["cant"])).toEqual([cant]);
  });

  it("reaches the guests on the waitlist only when the host picks them", () => {
    const waiting = guest("waitlisted", "sam@example.test");
    expect(recipients([waiting], ["going", "maybe"])).toEqual([]);
    expect(recipients([waiting], ["waitlisted"])).toEqual([waiting]);
  });

  it("leaves out the guests who gave no email, or blanked it", () => {
    expect(recipients([guest("going", null), guest("going", null, "token-kept-from-before")], ["going"])).toEqual([]);
  });

  it("leaves out a guest with no stop link to put at the foot of the email", () => {
    expect(recipients([guest("going", "priya@example.test", null)], ["going"])).toEqual([]);
  });

  it("leaves out the guests whose reply waits for the host or was declined, whatever their status", () => {
    const approved = guest("going", "priya@example.test");
    const pending = { ...guest("going", "mei@example.test"), approval: "pending" as const };
    const declined = { ...guest("maybe", "sam@example.test"), approval: "declined" as const };
    expect(recipients([pending, approved, declined], ["going", "maybe", "cant", "waitlisted"])).toEqual([approved]);
  });

  it("keeps the guests it emails in the order they came", () => {
    const first = guest("maybe", "mei@example.test");
    const second = guest("cant", "arjun@example.test");
    const third = guest("going", "priya@example.test");
    expect(recipients([first, guest("going", null), second, third], ["going", "maybe", "cant"])).toEqual([first, second, third]);
  });
});
