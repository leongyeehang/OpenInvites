import { addressed, type Addressable } from "./audience";

// Who is emailed when the host cancels (spec, "Cancellation notice"): the guests who said Going or
// Maybe, and those on the waitlist, and gave an email. Those who can't go are not told. A reply
// still waiting for the host's approval is told as an approved one is; one the host declined is
// not (spec, "Approval", decided there).
export function cancellationAudience<T extends Addressable>(rsvps: T[]): (T & { email: string; mailToken: string })[] {
  return addressed(rsvps, ["going", "maybe", "waitlisted"], ["approved", "pending"]);
}
