import { and, asc, count, desc, eq, exists, inArray, isNotNull, isNull, not, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, type Db } from "@/db/client";
import { event, invite, rsvp } from "@/db/schema";
import { chunks } from "@/lib/chunks";
import type { SavedStatus } from "@/rsvps/form";
import { generateMailToken } from "@/rsvps/token";
import { generateInviteToken, inviteFromRsvp, mailStopped, roomForInvite, type InviteInput } from "./invite";

export type Invite = typeof invite.$inferSelect;

// Makes one invite with a fresh token, unless the event already has as many as it can carry; then
// nothing is written and the answer is null. The event's row is locked while its invites are
// counted, so two made at once cannot both take the last place.
export async function createInvite(eventId: string, input: InviteInput): Promise<Invite | null> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    if (!roomForInvite(await countInvites(eventId, tx))) return null;
    const [created] = await tx
      .insert(invite)
      .values({ eventId, ...input, token: generateInviteToken() })
      .returning();
    return created;
  });
}

// Makes every invite of a pasted list, each with a fresh token, or none of them: when the event
// cannot carry them all, nothing is written and the answer is null. Under the event's lock, as one
// is made.
export async function createInvites(eventId: string, inputs: InviteInput[]): Promise<Invite[] | null> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("no key update");
    if (!roomForInvite(await countInvites(eventId, tx), inputs.length)) return null;
    return tx
      .insert(invite)
      .values(inputs.map((input) => ({ eventId, ...input, token: generateInviteToken() })))
      .returning();
  });
}

// How many invites one statement inserts: each binds eight parameters, and Postgres takes at most
// 65,535 in a statement, which an event's replies (up to the operator's limit) could pass at once.
const INVITES_AT_ONCE = 1000;

// Turning invite-only on (M6 ticket 08): every reply of the event that is tied to no invite gets
// one, made from the reply (invite.ts, inviteFromRsvp) with a fresh token, and the reply is tied to
// it both ways, so nobody who replied is locked out. Run by the transaction that turns the setting
// on, under its lock on the event's row, which every write of a reply takes first too, so a reply
// being written at that moment is either written first, and invited here, or after, when the event
// is invite-only and the reply is invited as it is written (rsvps/repository.ts, saveRsvp). Not
// held to the most invites a host may make: these are the guests the event already has. The
// invites go in a thousand at a time, and each reply is then tied to the invite made from it in
// one statement that names no ids. How many were made.
export async function inviteRepliedGuests(eventId: string, tx: Db, now: Date): Promise<number> {
  const replies = await tx
    .select({ id: rsvp.id, name: rsvp.name, email: rsvp.email, phone: rsvp.phone })
    .from(rsvp)
    .where(and(eq(rsvp.eventId, eventId), isNull(rsvp.inviteId)));
  if (replies.length === 0) return 0;
  for (const some of chunks(replies, INVITES_AT_ONCE)) {
    await tx.insert(invite).values(some.map((reply) => ({ eventId, ...inviteFromRsvp(reply, now), token: generateInviteToken() })));
  }
  await tx
    .update(rsvp)
    .set({ inviteId: sql`${invite.id}` })
    .from(invite)
    .where(and(eq(invite.eventId, eventId), eq(invite.rsvpId, rsvp.id), isNull(rsvp.inviteId)));
  return replies.length;
}

// The host's letter to one guest, scoped to the event, so another host's page cannot reach an
// invite. Whether there was such an invite to write it to.
export async function updateInviteLetter(eventId: string, id: string, letter: string): Promise<boolean> {
  const updated = await getDb()
    .update(invite)
    .set({ letter })
    .where(and(eq(invite.id, id), eq(invite.eventId, eventId)))
    .returning({ id: invite.id });
  return updated.length > 0;
}

export async function countInvites(eventId: string, db: Db = getDb()): Promise<number> {
  const [{ made }] = await db.select({ made: count() }).from(invite).where(eq(invite.eventId, eventId));
  return made;
}

// An invite as the host's pages list it: whom it is for, how to reach them, the host's letter to
// them, its link's token, when it was opened, when its invitation was sent and whether its guest
// stopped mail, and the status of the RSVP saved through it, when there is one, and whether its
// guest stopped mail through that RSVP's link.
export type ListedInvite = Pick<Invite, "id" | "name" | "email" | "phone" | "letter" | "token" | "openedAt" | "rsvpId" | "sentAt" | "mailStoppedAt"> & {
  status: SavedStatus | null;
  replyMailStoppedAt: Date | null;
};

// Every invite of the event, newest first, and those made at once by a pasted list in the order
// they were pasted: they share one time, and their ids, uuidv7s drawn in turn as one statement
// inserts them, rise in that order.
export async function listInvites(eventId: string): Promise<ListedInvite[]> {
  return getDb()
    .select({
      id: invite.id,
      name: invite.name,
      email: invite.email,
      phone: invite.phone,
      letter: invite.letter,
      token: invite.token,
      openedAt: invite.openedAt,
      rsvpId: invite.rsvpId,
      sentAt: invite.sentAt,
      mailStoppedAt: invite.mailStoppedAt,
      status: rsvp.status,
      replyMailStoppedAt: rsvp.mailStoppedAt,
    })
    .from(invite)
    .leftJoin(rsvp, eq(rsvp.id, invite.rsvpId))
    .where(eq(invite.eventId, eventId))
    .orderBy(desc(invite.createdAt), asc(invite.id));
}

// An invite whose invitation is being emailed: whom to, the secret of the stop link at its foot,
// and what the email says to them.
export type SentInvite = Pick<Invite, "id" | "name" | "letter" | "token"> & { email: string; mailToken: string };

// Marks these invites of the event as sent now, each given the mail token of its stop link the
// first time, and kept from then on, so every invitation sent to a guest stops with one link (as
// an RSVP's, rsvps/repository.ts). Only an invite that can still be emailed is marked, so one whose
// guest has stopped mail meanwhile, through an invitation or through the reply they made with it
// (invite.ts, canMailInvite), is not sent to; with `unsentOnly`, only one never sent before
// and not replied through (invite.ts, awaitsInvitation), so two "Send to everyone not yet sent" at
// once mail nobody twice, the second finding the rows the first has marked. One statement, so
// every row is marked or none, and those marked are returned.
export async function markInvitesSent(eventId: string, ids: string[], now: Date, { unsentOnly = false } = {}, db: Db = getDb()): Promise<SentInvite[]> {
  if (ids.length === 0) return [];
  // A fresh token for each row, which keeps it only when it has none.
  const fresh = sql.join(
    ids.map((id) => sql`when ${id}::uuid then ${generateMailToken()}`),
    sql` `,
  );
  const marked = await db
    .update(invite)
    .set({ sentAt: now, mailToken: sql`coalesce(${invite.mailToken}, case ${invite.id} ${fresh} end)` })
    .where(
      and(
        eq(invite.eventId, eventId),
        inArray(invite.id, ids),
        isNotNull(invite.email),
        isNull(invite.mailStoppedAt),
        not(exists(db.select({ id: rsvp.id }).from(rsvp).where(and(eq(rsvp.id, invite.rsvpId), isNotNull(rsvp.mailStoppedAt))))),
        unsentOnly ? and(isNull(invite.sentAt), isNull(invite.rsvpId)) : undefined,
      ),
    )
    .returning({ id: invite.id, name: invite.name, letter: invite.letter, token: invite.token, email: invite.email, mailToken: invite.mailToken });
  return marked.flatMap(({ email, mailToken, ...rest }) => (email && mailToken ? [{ ...rest, email, mailToken }] : []));
}

// The invites of the event whose invitations "Send to everyone not yet sent" sends: with an email,
// never sent, not replied through, and whose guest has not stopped mail (invite.ts,
// awaitsInvitation).
export async function listUnsentInvites(eventId: string): Promise<{ id: string }[]> {
  return getDb()
    .select({ id: invite.id })
    .from(invite)
    .where(and(eq(invite.eventId, eventId), isNotNull(invite.email), isNull(invite.sentAt), isNull(invite.mailStoppedAt), isNull(invite.rsvpId)));
}

// What the stop link at the foot of an invitation shows (app/m/[token]): the event's title, the
// email the host gave, and whether its guest has stopped mail, through this link or through their
// reply's (invite.ts, mailStopped), and nothing else of the invite. A stopped invite keeps its
// email, which is how its guest proves who they are, so the page says the mail is stopped rather
// than that no email is on file.
export async function findInviteByMailToken(mailToken: string): Promise<{ title: string; email: string | null; stopped: boolean } | undefined> {
  const [row] = await getDb()
    .select({ title: event.title, email: invite.email, mailStoppedAt: invite.mailStoppedAt, replyMailStoppedAt: rsvp.mailStoppedAt })
    .from(invite)
    .innerJoin(event, eq(event.id, invite.eventId))
    .leftJoin(rsvp, eq(rsvp.id, invite.rsvpId))
    .where(eq(invite.mailToken, mailToken))
    .limit(1);
  return row && { title: row.title, email: row.email, stopped: mailStopped(row) };
}

// The stop link's power over an invite: no more invitations are sent to it, from the first time it
// is used. Unlike an RSVP's, the email is kept: on an invite-only event it is how the guest proves
// they are the one invited (M6 spec, "Invite-only events"). A stop is for the whole event, as its
// page says, so the reply the guest made through the invite, if any, is stopped as its own link
// stops it (rsvps/repository.ts, blankEmailByMailToken), in the same transaction. Returns the
// event's title, or nothing when no invite has the token.
export async function stopInviteMail(mailToken: string): Promise<{ title: string } | undefined> {
  return getDb().transaction(async (tx) => {
    const [stopped] = await tx
      .update(invite)
      .set({ mailStoppedAt: sql`coalesce(${invite.mailStoppedAt}, now())` })
      .from(event)
      .where(and(eq(invite.mailToken, mailToken), eq(event.id, invite.eventId)))
      .returning({ title: event.title, rsvpId: invite.rsvpId });
    if (!stopped) return undefined;
    if (stopped.rsvpId) {
      await tx.update(rsvp).set({ email: null, emailVerifiedAt: null, mailStoppedAt: new Date() }).where(eq(rsvp.id, stopped.rsvpId));
    }
    return { title: stopped.title };
  });
}

// The invite a token names, with its event's links and whether the event is invite-only, or
// undefined for one that was never made or has been deleted.
export async function findInviteByToken(token: string): Promise<(Invite & { slug: string; customSlug: string | null; inviteOnly: boolean }) | undefined> {
  const [found] = await getDb()
    .select({ invite, slug: event.slug, customSlug: event.customSlug, inviteOnly: event.inviteOnly })
    .from(invite)
    .innerJoin(event, eq(event.id, invite.eventId))
    .where(eq(invite.token, token))
    .limit(1);
  return found && { ...found.invite, slug: found.slug, customSlug: found.customSlug, inviteOnly: found.inviteOnly };
}

// One invite of the event by its id, as a pass or a reply names it; nothing once it is deleted,
// which is what voids a pass (invites/pass.ts). Cached per request: the gate and the guest's
// identity both ask.
export const findInviteById = cache(async (eventId: string, id: string): Promise<Invite | undefined> => {
  const [found] = await getDb()
    .select()
    .from(invite)
    .where(and(eq(invite.id, id), eq(invite.eventId, eventId)))
    .limit(1);
  return found;
});

// The invite of the event an email belongs to, whatever its case, as a guest on the locked page
// types it (M6 spec, "The locked page"). The first made, should a host have listed one address
// twice.
export async function findInviteByEmail(eventId: string, email: string): Promise<Invite | undefined> {
  const [found] = await getDb()
    .select()
    .from(invite)
    .where(and(eq(invite.eventId, eventId), sql`lower(${invite.email}) = lower(${email})`))
    .orderBy(asc(invite.createdAt), asc(invite.id))
    .limit(1);
  return found;
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
