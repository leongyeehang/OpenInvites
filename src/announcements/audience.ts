import type { RsvpStatus } from "@/rsvps/form";

// What deciding who is emailed needs of an RSVP.
type Addressable = { status: RsvpStatus; email: string | null; mailToken: string | null };

// Who is emailed an announcement (spec, "Announcements"): the guests whose status is one the host
// ticked and who gave an email, in the order given. Every email to a guest ends with its stop
// link (spec, "Guest mail"), so a guest is emailed only when their RSVP has a mail token, which
// every RSVP with an email has (rsvps/cancellation.ts says why).
export function recipients<T extends Addressable>(rsvps: T[], audience: readonly RsvpStatus[]): (T & { email: string; mailToken: string })[] {
  return rsvps.filter((each): each is T & { email: string; mailToken: string } => {
    return audience.includes(each.status) && !!each.email && !!each.mailToken;
  });
}
