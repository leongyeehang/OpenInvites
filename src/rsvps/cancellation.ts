import type { RsvpStatus } from "./form";

// What deciding who is told needs of an RSVP.
type Addressable = { status: RsvpStatus; email: string | null; mailToken: string | null };

// Who is emailed when the host cancels (spec, "Cancellation notice"): the guests who said Going or
// Maybe and gave an email. Those who can't go are not told. Every email to a guest ends with its
// stop link (spec, "Guest mail"), so a guest is told only when their RSVP has a mail token, which
// every RSVP saved with an email has; one saved before mail tokens existed has none until the
// guest saves it again.
export function cancellationAudience<T extends Addressable>(rsvps: T[]): (T & { email: string; mailToken: string })[] {
  return rsvps.filter((each): each is T & { email: string; mailToken: string } => {
    return each.status !== "cant" && !!each.email && !!each.mailToken;
  });
}
