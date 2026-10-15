import { describe, expect, it } from "vitest";
import type { RsvpStatus } from "@/rsvps/form";
import { confettiFor } from "./trigger";

describe("when confetti falls", () => {
  const cases: [RsvpStatus | null, RsvpStatus | null, boolean][] = [
    // A first reply.
    [null, "going", true],
    [null, "maybe", false],
    [null, "cant", false],
    // A change of answer.
    ["maybe", "going", true],
    ["cant", "going", true],
    ["going", "maybe", false],
    ["going", "cant", false],
    ["maybe", "cant", false],
    ["cant", "maybe", false],
    // An edit that keeps the answer, Going included.
    ["going", "going", false],
    ["maybe", "maybe", false],
    ["cant", "cant", false],
    // A removed RSVP.
    ["going", null, false],
    [null, null, false],
  ];

  it.each(cases)("from %s to %s: %s", (before, after, falls) => {
    expect(confettiFor(before, after)).toBe(falls);
  });
});
