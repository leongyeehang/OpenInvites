import type { RsvpStatus } from "@/rsvps/form";

// Whether confetti falls as a guest's answer is saved (spec, "Effects"): when it makes them Going,
// as a first reply or a change from Maybe or Can't go. Not for Maybe or Can't go, and not for an
// edit that keeps them Going. `before` is the answer they had, null for none; `after` is the one
// just saved, null when they removed it.
export function confettiFor(before: RsvpStatus | null, after: RsvpStatus | null): boolean {
  return after === "going" && before !== "going";
}
