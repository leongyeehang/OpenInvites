import { describe, expect, it } from "vitest";
import type { Approval } from "@/rsvps/admission";
import type { SavedStatus } from "@/rsvps/form";
import { confettiFor } from "./trigger";

// An answer the host has let onto the list, as every answer is on an event without approval.
const approved = (status: SavedStatus) => ({ status, approval: "approved" as Approval });
const pending = (status: SavedStatus) => ({ status, approval: "pending" as Approval });
const declined = (status: SavedStatus) => ({ status, approval: "declined" as Approval });

describe("when confetti falls", () => {
  const cases: [string, ReturnType<typeof approved> | null, ReturnType<typeof approved> | null, boolean][] = [
    // A first reply.
    ["a first Going", null, approved("going"), true],
    ["a first Maybe", null, approved("maybe"), false],
    ["a first Can't go", null, approved("cant"), false],
    // A change of answer.
    ["Maybe to Going", approved("maybe"), approved("going"), true],
    ["Can't go to Going", approved("cant"), approved("going"), true],
    ["Going to Maybe", approved("going"), approved("maybe"), false],
    ["Going to Can't go", approved("going"), approved("cant"), false],
    ["Maybe to Can't go", approved("maybe"), approved("cant"), false],
    ["Can't go to Maybe", approved("cant"), approved("maybe"), false],
    // An edit that keeps the answer, Going included.
    ["Going kept", approved("going"), approved("going"), false],
    ["Maybe kept", approved("maybe"), approved("maybe"), false],
    ["Can't go kept", approved("cant"), approved("cant"), false],
    // A Going reply put on the waitlist, and one that stays there: no place yet, so no confetti.
    ["a first Going, waitlisted", null, approved("waitlisted"), false],
    ["Maybe to Going, waitlisted", approved("maybe"), approved("waitlisted"), false],
    ["waitlisted kept", approved("waitlisted"), approved("waitlisted"), false],
    // A Going reply waiting for the host's approval, or one they declined: the guest is not in
    // yet, so no confetti; the email saying they are in is the celebration.
    ["a first Going, pending", null, pending("going"), false],
    ["Maybe to Going, pending", pending("maybe"), pending("going"), false],
    ["Can't go to Going, declined", declined("cant"), declined("going"), false],
    // A removed RSVP.
    ["Going removed", approved("going"), null, false],
    ["nothing at all", null, null, false],
  ];

  it.each(cases)("%s", (_, before, after, falls) => {
    expect(confettiFor(before, after)).toBe(falls);
  });
});
