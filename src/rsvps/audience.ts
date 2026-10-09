import type { RsvpStatus } from "./form";

// What deciding who is emailed needs of an RSVP.
export type Addressable = { status: RsvpStatus; email: string | null; mailToken: string | null };

// Who of an event's guests is emailed (spec, "Guest mail"): the guests whose status is one of
// those given and who gave an email, in the order given. An announcement goes to the statuses the
// host ticked (spec, "Announcements"), the cancellation notice to Going and Maybe
// (cancellation.ts). Every email to a guest ends with its stop link, so a guest is emailed only
// when their RSVP has a mail token, which every RSVP with an email has: saveRsvp makes one, and
// migration 0015 gave one to every RSVP that already had an email.
export function recipients<T extends Addressable>(rsvps: T[], audience: readonly RsvpStatus[]): (T & { email: string; mailToken: string })[] {
  return rsvps.filter((each): each is T & { email: string; mailToken: string } => {
    return audience.includes(each.status) && !!each.email && !!each.mailToken;
  });
}
