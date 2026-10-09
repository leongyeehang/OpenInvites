import { describe, expect, it } from "vitest";
import { cancellationAudience } from "./cancellation";
import type { RsvpStatus } from "./form";

function guest(status: RsvpStatus, email: string | null, mailToken: string | null = email && `token-${email}`) {
  return { status, email, mailToken };
}

describe("cancellationAudience", () => {
  it("tells the Going and Maybe guests who gave an email", () => {
    const going = guest("going", "priya@example.test");
    const maybe = guest("maybe", "mei@example.test");
    expect(cancellationAudience([going, maybe])).toEqual([going, maybe]);
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
