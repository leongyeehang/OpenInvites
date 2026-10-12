import type { EventState } from "@/events/repository";
import type { Approval } from "@/rsvps/admission";

// Who is in front of an event page, as its comments see them (spec, "Comments"): a host of the
// event (its owner or a co-host, signed in), a guest whose RSVP is on this device, in any status,
// with whether the host has approved it, or someone who has not replied. A host who has also
// replied on this device is a host here.
export type CommentViewer = { kind: "host" } | { kind: "guest"; rsvpId: string; approval: Approval } | { kind: "visitor" };

// What a viewer gets of the comments. Like the guest list's "after you reply", they are a reward
// for answering, whatever the guest list's own setting: someone who has not replied sees how many
// there are and that replying opens them. Only a reply the host has approved opens them: a guest
// whose reply waits for the host, or was declined, sees what a visitor sees (spec, "Approval").
export type CommentsView = "open" | "locked";

export function commentsView(viewer: CommentViewer): CommentsView {
  if (viewer.kind === "guest") return viewer.approval === "approved" ? "open" : "locked";
  return viewer.kind === "visitor" ? "locked" : "open";
}

// Whether a viewer may post a comment now: the host has comments on, the viewer can read them, and
// the event is not cancelled, which keeps its comments and takes no new ones. A draft is seen only
// by its hosts, so only they comment on one.
export function takesComments(event: { state: EventState; commentsEnabled: boolean }, viewer: CommentViewer): boolean {
  if (!event.commentsEnabled || event.state === "cancelled" || commentsView(viewer) === "locked") return false;
  return event.state !== "draft" || viewer.kind === "host";
}

// One comment as the page shows it: who wrote it (the RSVP's name, or the host's display name with
// the "Host" mark), what they wrote, when, and whether this viewer may delete it.
export type ShownComment = { id: string; name: string; byHost: boolean; body: string; createdAt: Date; deletable: boolean };

// What a layout is handed of the comments: to a viewer they are locked for, only how many there are,
// and the approval of their own reply when they have one, which the line under the count speaks to;
// to one they are open for, the comments oldest first, and whether the form to post one is there.
export type CommentsShown =
  | { view: "locked"; count: number; approval?: Approval }
  | { view: "open"; comments: ShownComment[]; canPost: boolean };
