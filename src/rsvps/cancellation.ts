import { recipients, type Addressable } from "./audience";

// Who is emailed when the host cancels (spec, "Cancellation notice"): the guests who said Going or
// Maybe and gave an email. Those who can't go are not told.
export function cancellationAudience<T extends Addressable>(rsvps: T[]): (T & { email: string; mailToken: string })[] {
  return recipients(rsvps, ["going", "maybe"]);
}
