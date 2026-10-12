import type { Approval } from "@/rsvps/admission";
import type { SavedStatus } from "@/rsvps/form";

// An answer as the guest holds it: what it says, and whether the host has let it onto the list.
type Answer = { status: SavedStatus; approval: Approval };

// Whether confetti falls as a guest's answer is saved (spec, "Effects"): when it makes them Going,
// as a first reply or a change from Maybe or Can't go. Not for Maybe or Can't go, not for an edit
// that keeps them Going, not for a Going reply saved on the waitlist (spec, "Capacity and the
// waitlist"): only a reply that asked for Going is saved as Going; and not for one waiting for the
// host's approval, or declined by them: the guest is not in yet, and the email that tells them
// they are is the celebration (ticket 07). `before` is the answer they had, null for none; `after`
// is the one just saved, null when they removed it.
export function confettiFor(before: Answer | null, after: Answer | null): boolean {
  return after?.status === "going" && after.approval === "approved" && before?.status !== "going";
}
