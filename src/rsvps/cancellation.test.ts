import { describe, expect, it } from "vitest";
import type { Approval } from "./admission";
import { cancellationAudience } from "./cancellation";
import type { SavedStatus } from "./form";

// A guest the host has let onto the list, as every guest is on an event without approval.
function guest(status: SavedStatus, email: string | null, mailToken: string | null = email && `token-${email}`) {
  return { status, approval: "approved" as Approval, email, mailToken };
}

describe("cancellationAudience", () => {
  it("tells the Going and Maybe guests who gave an email", () => {
    const going = guest("going", "priya@example.test");
    const maybe = guest("maybe", "mei@example.test");
    expect(cancellationAudience([going, maybe])).toEqual([going, maybe]);
  });

  it("tells the guests on the waitlist, who were hoping to come", () => {
    const waiting = guest("waitlisted", "sam@example.test");
    expect(cancellationAudience([waiting])).toEqual([waiting]);
  });

  it("tells the guests whose reply waits for the host, as the approved ones, those who can’t go excepted", () => {
    const going = { ...guest("going", "priya@example.test"), approval: "pending" as const };
    const maybe = { ...guest("maybe", "mei@example.test"), approval: "pending" as const };
    const cant = { ...guest("cant", "arjun@example.test"), approval: "pending" as const };
    expect(cancellationAudience([going, cant, maybe])).toEqual([going, maybe]);
  });

  it("does not tell the guests the host declined", () => {
    expect(cancellationAudience([{ ...guest("going", "sam@example.test"), approval: "declined" as const }])).toEqual([]);
  });

  it("does not tell the guests who can’t go, though they gave an email", () => {
    expect(cancellationAudience([guest("cant", "arjun@example.test")])).toEqual([]);
  });

  it("does not tell the guests who gave no email, or blanked it", () => {
    expect(cancellationAudience([guest("going", null), guest("maybe", null, "token-kept-from-before")])).toEqual([]);
  });

  it("does not tell a guest with no stop link to put at the foot of the email", () => {
    expect(cancellationAudience([guest("going", "priya@example.test", null)])).toEqual([]);
  });

  it("keeps the guests it tells in the order they came", () => {
    const first = guest("maybe", "mei@example.test");
    const second = guest("going", "priya@example.test");
    expect(cancellationAudience([first, guest("cant", "arjun@example.test"), guest("going", null), second])).toEqual([first, second]);
  });
});
