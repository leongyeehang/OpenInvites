"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/auth/session";
import { findEventBySlug, findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { isUuid } from "@/lib/uuid";
import { consume } from "@/rate-limit/rate-limit";
import { findRsvpOnThisDevice } from "@/rsvps/guest";
import { mayDelete, parseComment, type CommentError } from "./comment";
import { notifyHostsOfComment } from "./notify-hosts";
import { createComment, deleteComment, findComment, type CommentAuthor } from "./repository";
import { takesComments, type CommentViewer } from "./visibility";

// Why a comment was refused. The guest's own browser turns it into a sentence. Closed is an event
// that takes no comment from this viewer (gone, cancelled, comments off, or not replied); too fast
// is the rate limit; too many is the event's cap.
export type CommentRefusal = CommentError | "closed" | "tooMany" | "tooFast";

export type CommentState = { error?: CommentRefusal; posted?: true } | undefined;

type Commenter = { viewer: CommentViewer; author?: CommentAuthor; name?: string };

// Who is in front of the event page, as the page itself decides it: a host of the event, found
// through the one gate and let comment by their role, before anything else; then the guest whose
// RSVP is on this device, under its name. A host who has also replied on this device comments as a
// host. A signed-in host the gate refuses is simply not a host here.
async function commenter(eventId: string): Promise<Commenter> {
  const session = await getSession();
  const hosted = session ? await findHostEvent(session.user.id, eventId) : undefined;
  if (session && hosted && can(hosted.role, "comments")) {
    return { viewer: { kind: "host" }, author: { hostId: session.user.id }, name: session.user.name };
  }
  const mine = await findRsvpOnThisDevice(eventId);
  if (mine) return { viewer: { kind: "guest", rsvpId: mine.rsvp.id }, author: { rsvpId: mine.rsvp.id }, name: mine.rsvp.name };
  return { viewer: { kind: "visitor" } };
}

// Posting a comment, as a guest who has replied or as a host (spec, "Comments"). Every post counts
// against the comment limit before anything is looked up, as an RSVP does against its own.
export async function postCommentAction(slug: string, _: CommentState, formData: FormData): Promise<CommentState> {
  if (!(await consume("comment", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event) return { error: "closed" };
  const { viewer, author, name } = await commenter(event.id);
  if (!author || !name || !takesComments(event, viewer)) return { error: "closed" };

  const posted = formData.get("body");
  const parsed = parseComment(typeof posted === "string" ? posted : "");
  if (!parsed.ok) return { error: parsed.error };

  const created = await createComment(event.id, author, parsed.body);
  if (!created) return { error: "tooMany" };
  await notifyHostsOfComment(event, { name, body: created.body, hostId: created.hostId });
  // The page shows comments as loaded, so the one just posted appears with the page drawn again.
  revalidatePath(`/e/${event.slug}`);
  return { posted: true };
}

// A guest deletes their own comment, a host any (comment.ts, mayDelete). Every delete counts
// against the comment limit before anything is looked up, as a post does. One this viewer may not
// delete is left as it is, as one that does not exist is.
export async function deleteCommentAction(slug: string, id: string): Promise<{ error?: "tooFast" }> {
  if (!(await consume("comment", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event || !isUuid(id)) return {};
  const [{ viewer }, found] = await Promise.all([commenter(event.id), findComment(event.id, id)]);
  if (!found || !mayDelete(viewer, found)) return {};
  await deleteComment(event.id, found.id);
  revalidatePath(`/e/${event.slug}`);
  return {};
}
