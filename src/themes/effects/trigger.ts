import type { SavedStatus } from "@/rsvps/form";

// Whether confetti falls as a guest's answer is saved (spec, "Effects"): when it makes them Going,
// as a first reply or a change from Maybe or Can't go. Not for Maybe or Can't go, not for an edit
// that keeps them Going, and not for a Going reply saved on the waitlist (spec, "Capacity and the
// waitlist"): only a reply that asked for Going is saved as Going. `before` is the answer they
// had, null for none; `after` is the one just saved, null when they removed it.
export function confettiFor(before: SavedStatus | null, after: SavedStatus | null): boolean {
  return after === "going" && before !== "going";
}
