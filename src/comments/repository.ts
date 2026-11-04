import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { comment, commentReaction, event, rsvp, user } from "@/db/schema";
import { roomForAnother } from "./comment";
import type { Reaction, ReactionRow, Reactor } from "./reactions";

export type Comment = typeof comment.$inferSelect;

// A comment with the name it is shown under: the RSVP's name for a guest's, the host's display name
// for a host's, as they are now.
export type NamedComment = Comment & { name: string };

// Who wrote a comment: exactly one of an RSVP and a host.
export type CommentAuthor = { rsvpId: string; hostId?: undefined } | { hostId: string; rsvpId?: undefined };

// An event's comments, oldest first, as its page shows them.
export async function listComments(eventId: string): Promise<NamedComment[]> {
  const rows = await getDb()
    .select({ comment, name: sql<string>`coalesce(${rsvp.name}, ${user.name})` })
    .from(comment)
    .leftJoin(rsvp, eq(rsvp.id, comment.rsvpId))
    .leftJoin(user, eq(user.id, comment.hostId))
    .where(eq(comment.eventId, eventId))
    .orderBy(asc(comment.createdAt), asc(comment.id));
  return rows.map((row) => ({ ...row.comment, name: row.name }));
}

// How many comments an event has, which is all a viewer they are locked for is told.
export async function countComments(eventId: string): Promise<number> {
  const [{ posted }] = await getDb().select({ posted: count() }).from(comment).where(eq(comment.eventId, eventId));
  return posted;
}

// Posts one comment, unless the event already has as many as it can carry; then nothing is written
// and the answer is null. The event's row is locked while its comments are counted, so two posts at
// once cannot both take the last place.
export async function createComment(eventId: string, author: CommentAuthor, body: string): Promise<Comment | null> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    const [{ posted }] = await tx.select({ posted: count() }).from(comment).where(eq(comment.eventId, eventId));
    if (!roomForAnother(posted)) return null;
    const [created] = await tx
      .insert(comment)
      .values({ eventId, rsvpId: author.rsvpId ?? null, hostId: author.hostId ?? null, body })
      .returning();
    return created;
  });
}

// One comment of the event's, to see who may delete it.
export async function findComment(eventId: string, id: string): Promise<Comment | undefined> {
  return getDb().query.comment.findFirst({ where: and(eq(comment.id, id), eq(comment.eventId, eventId)) });
}

// Scoped to the event, so another event's page cannot reach a comment.
export async function deleteComment(eventId: string, id: string): Promise<void> {
  await getDb().delete(comment).where(and(eq(comment.id, id), eq(comment.eventId, eventId)));
}

// Every reaction to an event's comments, oldest first, each with the name it is shown under.
export async function listReactions(eventId: string): Promise<ReactionRow[]> {
  return getDb()
    .select({
      commentId: commentReaction.commentId,
      emoji: commentReaction.emoji,
      rsvpId: commentReaction.rsvpId,
      hostId: commentReaction.hostId,
      name: sql<string>`coalesce(${rsvp.name}, ${user.name})`,
    })
    .from(commentReaction)
    .innerJoin(comment, eq(comment.id, commentReaction.commentId))
    .leftJoin(rsvp, eq(rsvp.id, commentReaction.rsvpId))
    .leftJoin(user, eq(user.id, commentReaction.hostId))
    .where(eq(comment.eventId, eventId))
    .orderBy(asc(commentReaction.createdAt), asc(commentReaction.id));
}

function byReactor(reactor: Reactor) {
  return reactor.rsvpId !== undefined ? eq(commentReaction.rsvpId, reactor.rsvpId) : eq(commentReaction.hostId, reactor.hostId);
}

// Gives the emoji, or takes it back if this reactor has given it already. Pressed twice at once,
// the second press finds the first's row or meets its unique constraint, and gives nothing twice.
export async function toggleReaction(commentId: string, reactor: Reactor, emoji: Reaction): Promise<void> {
  const db = getDb();
  const removed = await db
    .delete(commentReaction)
    .where(and(eq(commentReaction.commentId, commentId), eq(commentReaction.emoji, emoji), byReactor(reactor)))
    .returning({ id: commentReaction.id });
  if (removed.length > 0) return;
  await db
    .insert(commentReaction)
    .values({ commentId, emoji, rsvpId: reactor.rsvpId ?? null, hostId: reactor.hostId ?? null })
    .onConflictDoNothing();
}
