import { RSVP_STATUSES, type RsvpStatus } from "@/rsvps/form";

// An announcement (CONTEXT.md): a message the host posts to the event page, which is also emailed
// to the guests they pick by status (spec, "Announcements"). Plain text with its line breaks, and
// nothing else formatted.
export const MAX_BODY = 2000;

// The most an event can carry (decisions log).
export const MAX_ANNOUNCEMENTS = 10;

// Whom the form offers to email until the host says otherwise: the guests who are coming, or may.
export const DEFAULT_AUDIENCE: readonly RsvpStatus[] = ["going", "maybe"];

// What the host's form posts, before any of it is trusted: the text, and the statuses ticked.
export type AnnouncementFields = { body: string; audience: string[] };

// One announcement, once trusted. The audience names the statuses the host ticked, each once, in
// the order the RSVP buttons show them.
export type AnnouncementInput = { body: string; audience: RsvpStatus[] };

export type AnnouncementError = "bodyRequired" | "bodyTooLong" | "audienceRequired" | "audienceInvalid";

export type ParsedAnnouncement = { ok: true; announcement: AnnouncementInput } | { ok: false; error: AnnouncementError };

function isStatus(value: string): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value);
}

// The rules of the announcement form (ticket 03). A browser posts a textarea's line breaks as
// CR LF; they are kept as one line feed each, so a line break counts as one character, as the
// textarea counted it while the host typed.
export function parseAnnouncement(fields: AnnouncementFields): ParsedAnnouncement {
  const body = fields.body.replace(/\r\n?/g, "\n").trim();
  if (!body) return { ok: false, error: "bodyRequired" };
  if (body.length > MAX_BODY) return { ok: false, error: "bodyTooLong" };
  if (fields.audience.length === 0) return { ok: false, error: "audienceRequired" };
  if (!fields.audience.every(isStatus)) return { ok: false, error: "audienceInvalid" };
  const audience = RSVP_STATUSES.filter((status) => fields.audience.includes(status));
  return { ok: true, announcement: { body, audience } };
}

// Whether an event that already has this many announcements may have one more.
export function roomForAnother(posted: number): boolean {
  return posted < MAX_ANNOUNCEMENTS;
}
