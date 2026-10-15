import type { CommentViewer } from "./visibility";

// A comment (CONTEXT.md): a message a guest who has replied, or a host, posts on the event page
// for everyone who can read the comments (spec, "Comments"). Plain text with its line breaks, and
// nothing else formatted.
export const MAX_BODY = 1000;

// The most an event can carry.
export const MAX_COMMENTS = 500;

export type CommentError = "bodyRequired" | "bodyTooLong";

export type ParsedComment = { ok: true; body: string } | { ok: false; error: CommentError };

// The rules of the comment form. A browser posts a textarea's line breaks as CR LF; they are kept as
// one line feed each, so a line break counts as one character, as the textarea counted it.
export function parseComment(posted: string): ParsedComment {
  const body = posted.replace(/\r\n?/g, "\n").trim();
  if (!body) return { ok: false, error: "bodyRequired" };
  if (body.length > MAX_BODY) return { ok: false, error: "bodyTooLong" };
  return { ok: true, body };
}

// Whether an event that already has this many comments may have one more.
export function roomForAnother(posted: number): boolean {
  return posted < MAX_COMMENTS;
}

// A guest deletes their own comment; a host deletes any (decisions log). A guest's own is one their
// RSVP on this device wrote.
export function mayDelete(viewer: CommentViewer, comment: { rsvpId: string | null }): boolean {
  if (viewer.kind === "host") return true;
  return viewer.kind === "guest" && comment.rsvpId === viewer.rsvpId;
}
