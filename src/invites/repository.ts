import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, invite, rsvp } from "@/db/schema";
import type { SavedStatus } from "@/rsvps/form";
import { generateInviteToken, roomForInvite, type InviteInput } from "./invite";

export type Invite = typeof invite.$inferSelect;

// Makes one invite with a fresh token, unless the event already has as many as it can carry; then
// nothing is written and the answer is null. The event's row is locked while its invites are
// counted, so two made at once cannot both take the last place.
export async function createInvite(eventId: string, input: InviteInput): Promise<Invite | null> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    const [{ made }] = await tx.select({ made: count() }).from(invite).where(eq(invite.eventId, eventId));
    if (!roomForInvite(made)) return null;
    const [created] = await tx
      .insert(invite)
      .values({ eventId, ...input, token: generateInviteToken() })
      .returning();
    return created;
  });
}

export async function countInvites(eventId: string): Promise<number> {
  const [{ made }] = await getDb().select({ made: count() }).from(invite).where(eq(invite.eventId, eventId));
  return made;
}

// An invite as the host's pages list it: whom it is for, its link's token, when it was opened, and
// the status of the RSVP saved through it, when there is one.
export type ListedInvite = Pick<Invite, "id" | "name" | "email" | "token" | "openedAt" | "rsvpId"> & { status: SavedStatus | null };

// Every invite of the event, newest first.
export async function listInvites(eventId: string): Promise<ListedInvite[]> {
  return getDb()
    .select({
      id: invite.id,
      name: invite.name,
      email: invite.email,
      token: invite.token,
      openedAt: invite.openedAt,
      rsvpId: invite.rsvpId,
      status: rsvp.status,
    })
    .from(invite)
    .leftJoin(rsvp, eq(rsvp.id, invite.rsvpId))
    .where(eq(invite.eventId, eventId))
    .orderBy(desc(invite.createdAt), desc(invite.id));
}

// The invite a token names, with its event's links, or undefined for one that was never made or
// has been deleted.
export async function findInviteByToken(token: string): Promise<(Invite & { slug: string; customSlug: string | null }) | undefined> {
  const [found] = await getDb()
    .select({ invite, slug: event.slug, customSlug: event.customSlug })
    .from(invite)
    .innerJoin(event, eq(event.id, invite.eventId))
    .where(eq(invite.token, token))
    .limit(1);
  return found && { ...found.invite, slug: found.slug, customSlug: found.customSlug };
}

// The first time the link is opened is the one the host is told of.
export async function markInviteOpened(id: string, now: Date): Promise<void> {
  await getDb()
    .update(invite)
    .set({ openedAt: now })
    .where(and(eq(invite.id, id), isNull(invite.openedAt)));
}

// Scoped to the event, so another host's page cannot reach an invite. Its link stops working; the
// RSVP saved through it stays, unlinked by the database (rsvp.invite_id is set null), and keeps its
// edit token, so the guest's device still finds it. That writes an RSVP, so the event's row is
// locked first, as every write of one does (rsvps/repository.ts), and a guest replying through the
// invite at that moment either finishes first or finds it gone.
export async function deleteInvite(eventId: string, id: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    await tx.delete(invite).where(and(eq(invite.id, id), eq(invite.eventId, eventId)));
  });
}
