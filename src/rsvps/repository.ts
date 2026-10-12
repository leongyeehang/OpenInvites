import { and, asc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, type Db } from "@/db/client";
import { emailCode, event, invite, rsvp } from "@/db/schema";
import { acceptsRsvps } from "@/events/access";
import type { Locale } from "@/locale/resolve-locale";
import { isMailConfigured } from "@/mail/config";
import { guestMails } from "@/mail/guest-mail";
import { queueMail } from "@/mail/outbox";
import { admit, hostStatus, waitlistedSince, type Approval } from "./admission";
import { approvalMail } from "./approval-mail";
import { approvalAudience, recipients } from "./audience";
import { countRsvps, type RsvpCounts, type StatusTally } from "./counts";
import { chosenStatus, type RsvpInput, type RsvpStatus, type SavedStatus } from "./form";
import { repliesAtLimit } from "./limit";
import { planHostEdit, planRsvp } from "./plan";
import { promotionMail } from "./promotion-mail";
import { generateEditToken, generateMailToken, hashEditToken } from "./token";
import { codeVerdict, MAX_ATTEMPTS, RESEND_SECONDS, type CodeVerdict } from "./verification";
import { promotable } from "./waitlist";

export type Rsvp = typeof rsvp.$inferSelect;

// The event's row as the transaction that writes a reply locks it.
type LockedEvent = typeof event.$inferSelect;

// The RSVP an edit token opens on one event. Cached per request: the page and its metadata
// both ask.
export const findRsvpByToken = cache(async (eventId: string, token: string): Promise<Rsvp | undefined> => {
  return getDb().query.rsvp.findFirst({
    where: and(eq(rsvp.eventId, eventId), eq(rsvp.editTokenHash, hashEditToken(token))),
  });
});

// An edit token names its event as well as its RSVP, so an edit link works on a device that has
// never opened the invitation.
export async function findEventForToken(token: string): Promise<{ eventId: string; slug: string; customSlug: string | null } | undefined> {
  const [row] = await getDb()
    .select({ eventId: rsvp.eventId, slug: event.slug, customSlug: event.customSlug })
    .from(rsvp)
    .innerJoin(event, eq(event.id, rsvp.eventId))
    .where(eq(rsvp.editTokenHash, hashEditToken(token)))
    .limit(1);
  return row;
}

// An RSVP together with the edit token that opened it, which is what the guest holds.
export type MyRsvp = { rsvp: Rsvp; token: string };

// Every write of an RSVP goes through one transaction (spec, "Architecture"): it locks the event's
// row first, FOR NO KEY UPDATE, then the reply's own row, the order removeEvents takes; it decides
// what the reply becomes against the headcount without it (admission.ts), writes it, and promotes
// whoever the waitlist then has room for, queueing their email in the same transaction. Two replies
// to one event therefore run one after the other, and cannot both take the last place. The lock is
// the reminders' (reminders/queue.ts); it does not hold up a write that only refers to the event,
// such as a comment, whose foreign key takes KEY SHARE.
async function lockEvent(tx: Db, eventId: string): Promise<LockedEvent | undefined> {
  const [locked] = await tx.select().from(event).where(eq(event.id, eventId)).for("no key update");
  return locked;
}

async function lockRsvp(tx: Db, eventId: string, id: string): Promise<Rsvp | undefined> {
  const [locked] = await tx
    .select()
    .from(rsvp)
    .where(and(eq(rsvp.id, id), eq(rsvp.eventId, eventId)))
    .for("update");
  return locked;
}

// A personal invite of the event that nobody has replied through yet, locked for the reply that is
// about to be; nothing once it has been deleted, or answered from another device.
async function lockOpenInvite(tx: Db, eventId: string, id: string): Promise<{ id: string; token: string } | undefined> {
  const [locked] = await tx
    .select({ id: invite.id, token: invite.token })
    .from(invite)
    .where(and(eq(invite.id, id), eq(invite.eventId, eventId), isNull(invite.rsvpId)))
    .for("update");
  return locked;
}

// The people expected (CONTEXT.md, "Headcount"): the Going guests the host has approved and their
// plus-ones, without the one RSVP being written when it is named, as admission counts it. A Going
// reply waiting for the host's approval, or declined by them, takes no place (spec, "Approval").
export async function countHeadcount(eventId: string, db: Db = getDb(), without?: string): Promise<number> {
  const [row] = await db
    .select({ headcount: sql<number>`coalesce(sum(1 + ${rsvp.plusOnes}), 0)::int` })
    .from(rsvp)
    .where(and(eq(rsvp.eventId, eventId), eq(rsvp.status, "going"), eq(rsvp.approval, "approved"), without ? ne(rsvp.id, without) : undefined));
  return row.headcount;
}

// The waitlist in its order, the order its RSVPs joined it, which is the order they are promoted in.
// Only an approved reply is ever on it (admission.ts).
async function listWaitlist(eventId: string, db: Db): Promise<{ id: string; plusOnes: number }[]> {
  return db
    .select({ id: rsvp.id, plusOnes: rsvp.plusOnes })
    .from(rsvp)
    .where(and(eq(rsvp.eventId, eventId), eq(rsvp.status, "waitlisted"), eq(rsvp.approval, "approved")))
    .orderBy(asc(rsvp.waitlistedAt), asc(rsvp.repliedAt), asc(rsvp.id));
}

// A waitlisted guest's place in the waitlist, the first being 1; null for an RSVP not on it.
export async function findWaitlistPosition(saved: Pick<Rsvp, "id" | "eventId" | "status">, db: Db = getDb()): Promise<number | null> {
  if (saved.status !== "waitlisted") return null;
  const at = (await listWaitlist(saved.eventId, db)).findIndex((waiting) => waiting.id === saved.id);
  return at < 0 ? null : at + 1;
}

// What a write of an RSVP did to the waitlist: the RSVPs it promoted to Going, and whether any of
// them was queued an email, so the caller kicks the mail worker once the transaction is over.
export type Promotion = { promoted: Rsvp[]; mailed: boolean };

// Promotes, inside the caller's transaction and under its lock on the event, every waitlisted
// RSVP the event now has room for, in order, stopping at the first party that does not fit
// (waitlist.ts). Without a capacity there is room for all. Each is set to Going, leaves the
// waitlist and records when; each guest who gave an email is queued one email when the instance
// has mail (promotion-mail.ts). The hosts are not told: a promotion is not the guest's doing.
// Only an event that takes replies promotes anyone (events/access.ts): on a cancelled one a guest
// may still withdraw, and the place they leave is no place at all, so nobody on the waitlist is
// told "A place opened up" after the notice that the event is off.
export async function promoteWaitlist(locked: LockedEvent, tx: Db, now: Date): Promise<Promotion> {
  if (!acceptsRsvps(locked.state)) return { promoted: [], mailed: false };
  const waitlist = await listWaitlist(locked.id, tx);
  if (waitlist.length === 0) return { promoted: [], mailed: false };
  const space = locked.capacity === null ? Infinity : locked.capacity - (await countHeadcount(locked.id, tx));
  const ids = promotable(waitlist.map((waiting) => ({ id: waiting.id, party: partyOf(waiting) })), space);
  if (ids.length === 0) return { promoted: [], mailed: false };
  const promoted = await tx
    .update(rsvp)
    .set({ status: "going", waitlistedAt: null, promotedAt: now })
    .where(inArray(rsvp.id, ids))
    .returning();
  return { promoted, mailed: await queuePromotionMail(locked, promoted, tx) };
}

// The email that tells each promoted guest who gave an email that they are in, queued with the
// write that promoted them. Whether any was queued.
async function queuePromotionMail(locked: LockedEvent, promoted: Rsvp[], tx: Db): Promise<boolean> {
  const guests = isMailConfigured() ? recipients(promoted, ["going"]) : [];
  if (guests.length === 0) return false;
  await queueMail(await guestMails(locked, guests, (guest, t) => promotionMail(locked, guest, t)), tx);
  return true;
}

// The party an RSVP brings: the guest and their plus-ones.
function partyOf(reply: { plusOnes: number }): number {
  return 1 + reply.plusOnes;
}

// What saving a guest's answer did: refused it (the event has gone, the operator's limit on
// replies, or no room for the party a Going guest raised), or saved it. `written` is the RSVP as
// the answer left it, which the hosts are told of (notify-hosts.ts), and `saved` as the guest now
// holds it, which the waitlist may have promoted at once; `previous` is the RSVP before, read
// under the lock.
export type SaveOutcome =
  | { refused: "closed" | "limitReached" }
  | { refused: "capacityFull"; placesLeft: number }
  | { saved: MyRsvp; written: Rsvp; previous: Rsvp | undefined; waitlistPosition: number | null; mailed: boolean };

// Saves one answer, in the language the guest gave it in, through the one transaction above. A
// guest who already has an RSVP here changes it and keeps their edit token; anyone else gets a new
// RSVP with a fresh one, if the event has room for another reply, waiting for the host's approval
// when the event asks for it. The first save with an email makes the RSVP's mail token, and every
// later save keeps it, even one that blanks the email, so the stop link in an old email still
// finds its page (spec, "Guest mail"). An email or phone number the host does not ask for is
// undefined in the input, and left as stored. `proven` says the email the guest gave is proven:
// they have just entered the code sent to it, or it is the one on their personal invite (plan.ts).
//
// A new RSVP through a personal invite (`throughInvite`, which the guest's device opened) is tied
// to it both ways, and takes the invite's token as its edit token, so the invite link is the
// guest's edit link (spec, "Personal invite links"). It is approved whatever the event's approval
// setting, as the host issued it, and the capacity applies to it as to any reply (admission.ts). An
// invite deleted or answered from another device since the guest's device found it is refused as
// closed: the reply would be tied to nothing, or a second one to the same invite.
export async function saveRsvp(
  eventId: string,
  input: RsvpInput & { locale: Locale },
  mine: MyRsvp | undefined,
  proven = false,
  throughInvite?: { id: string },
): Promise<SaveOutcome> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const locked = await lockEvent(tx, eventId);
    if (!locked) return { refused: "closed" };
    const current = mine && (await lockRsvp(tx, eventId, mine.rsvp.id));
    const invited = !current && throughInvite ? await lockOpenInvite(tx, eventId, throughInvite.id) : undefined;
    if (!current && throughInvite && !invited) return { refused: "closed" };
    if (!current && (await repliesAtLimit(eventId, tx))) return { refused: "limitReached" };

    const admitted = admit({
      approvalRequired: locked.approvalRequired,
      capacity: locked.capacity,
      headcount: await countHeadcount(eventId, tx, current?.id),
      invited: invited !== undefined,
      wanted: input.status,
      party: partyOf(input),
      current: current && { status: current.status, approval: current.approval, party: partyOf(current) },
    });
    if ("refused" in admitted) return admitted;
    // A guest's save gives a new RSVP its approval and never changes an existing one's, which
    // admission keeps as it is: only a host approves or declines (approveRsvp, declineRsvp).
    const placed = { status: admitted.status, waitlistedAt: waitlistedSince(admitted.status, current, now) };

    const plan = planRsvp(eventId, input, current && mine && { id: current.id, token: mine.token, email: current.email }, now, proven);
    let written: MyRsvp;
    if (plan.replaces) {
      const mailToken = input.email ? sql`coalesce(${rsvp.mailToken}, ${generateMailToken()})` : undefined;
      const [replaced] = await tx
        .update(rsvp)
        .set({ ...plan.changes, ...placed, locale: input.locale, mailToken })
        .where(eq(rsvp.id, plan.replaces.id))
        .returning();
      written = { rsvp: replaced, token: plan.replaces.token };
    } else {
      const token = invited?.token ?? generateEditToken();
      const [created] = await tx
        .insert(rsvp)
        .values({
          ...plan.rsvp,
          ...placed,
          approval: admitted.approval,
          locale: input.locale,
          inviteId: invited?.id,
          editTokenHash: hashEditToken(token),
          mailToken: input.email ? generateMailToken() : null,
        })
        .returning();
      if (invited) await tx.update(invite).set({ rsvpId: created.id }).where(eq(invite.id, invited.id));
      written = { rsvp: created, token };
    }

    const { promoted, mailed } = await promoteWaitlist(locked, tx, now);
    const saved = promoted.find((each) => each.id === written.rsvp.id) ?? written.rsvp;
    return {
      saved: { rsvp: saved, token: written.token },
      written: written.rsvp,
      previous: current,
      waitlistPosition: await findWaitlistPosition(saved, tx),
      mailed,
    };
  });
}

// The guest list as the host reads it (spec, story 52): everything a host needs to plan. Never
// the edit token, which belongs to the guest alone: the rows reach a client component, so
// anything selected here is serialised into the host's page.
export type HostGuest = {
  id: string;
  name: string;
  status: SavedStatus;
  // Whether the host has let the reply onto the list, which decides its section.
  approval: Approval;
  plusOnes: number;
  plusOneNames: string[];
  email: string | null;
  // When the guest proved the email by a code, if they did.
  emailVerifiedAt: Date | null;
  phone: string | null;
  // When the guest stopped email about the event with the stop link, if they have.
  mailStoppedAt: Date | null;
  repliedAt: Date;
  updatedAt: Date;
};

export async function listGuestList(eventId: string): Promise<HostGuest[]> {
  return getDb()
    .select({
      id: rsvp.id,
      name: rsvp.name,
      status: rsvp.status,
      approval: rsvp.approval,
      plusOnes: rsvp.plusOnes,
      plusOneNames: rsvp.plusOneNames,
      email: rsvp.email,
      emailVerifiedAt: rsvp.emailVerifiedAt,
      phone: rsvp.phone,
      mailStoppedAt: rsvp.mailStoppedAt,
      repliedAt: rsvp.repliedAt,
      updatedAt: rsvp.updatedAt,
    })
    .from(rsvp)
    .where(eq(rsvp.eventId, eventId))
    // The waitlist in its order, then everyone else in the order they replied.
    .orderBy(asc(rsvp.waitlistedAt), asc(rsvp.repliedAt), asc(rsvp.id));
}

// And as a guest reads it (spec, "RSVP flow"): names, statuses, and how many each is bringing.
// The email and the edit token are never loaded, so they cannot leak into the page even blurred.
// Nobody on the waitlist is listed, nor counted in what the page shows (spec, "Capacity and the
// waitlist"), so every status here is one of the three a guest chooses; nor is a reply waiting for
// the host's approval or declined by them (spec, "Approval"), so every one here is approved.
export type PublicGuest = { id: string; name: string; status: RsvpStatus; approval: Approval; plusOnes: number };

export async function listPublicGuestList(eventId: string): Promise<PublicGuest[]> {
  const rows = await getDb()
    .select({ id: rsvp.id, name: rsvp.name, status: rsvp.status, approval: rsvp.approval, plusOnes: rsvp.plusOnes })
    .from(rsvp)
    .where(and(eq(rsvp.eventId, eventId), ne(rsvp.status, "waitlisted"), eq(rsvp.approval, "approved")))
    .orderBy(asc(rsvp.repliedAt));
  return rows as PublicGuest[];
}

// What a host's change to a guest's RSVP did: the RSVP as it was and as it is now, both read under
// the transaction's lock, so the hosts are told of the change that was made (notify-hosts.ts), and
// whether a promotion it made queued an email.
export type HostChange = { previous: Rsvp; current: Rsvp; mailed: boolean };

// A host changing a guest's RSVP on their behalf (spec, story 53, and "Contact details"), through
// the one transaction that writes RSVPs. It writes only what a host may set, so the guest's edit
// token survives untouched and the link in their pocket keeps working, and never an email for a
// guest who stopped email about the event (planHostEdit, decided under the same lock as the
// write), nor a proven mark on an email the host changed. An email the host gives gets the RSVP
// its mail token, as a guest's does in saveRsvp, so every email to it can end with its stop link.
// The status is the host's choice, never refused by capacity (hostStatus); a place it frees goes
// to the waitlist. It never changes the approval: the host approves or declines with their own
// buttons (approveRsvp, declineRsvp).
export async function editRsvpAsHost(eventId: string, id: string, edit: RsvpInput): Promise<HostChange | undefined> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const locked = await lockEvent(tx, eventId);
    const previous = locked && (await lockRsvp(tx, eventId, id));
    if (!locked || !previous) return undefined;
    const allowed = planHostEdit(edit, previous);
    const status = hostStatus(edit.status, previous.status);
    const mailToken = allowed.email ? sql`coalesce(${rsvp.mailToken}, ${generateMailToken()})` : undefined;
    const [current] = await tx
      .update(rsvp)
      .set({ ...allowed, status, waitlistedAt: waitlistedSince(status, previous, now), mailToken, updatedAt: now })
      .where(eq(rsvp.id, id))
      .returning();
    const { mailed } = await promoteWaitlist(locked, tx, now);
    return { previous, current, mailed };
  });
}

// The host's Move to Going on a waitlisted guest (spec, story 145): Going at once, whatever the
// capacity, which a host's change never answers to. It is a promotion made by hand, so the guest
// who gave an email is told as a promoted guest is, while the event takes replies: on a cancelled
// event the host's change still stands, but "A place opened up" would contradict the notice that
// the event is off, so no email goes (promoteWaitlist). Nothing for an RSVP no longer on the
// waitlist.
export async function moveToGoing(eventId: string, id: string): Promise<HostChange | undefined> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const locked = await lockEvent(tx, eventId);
    const previous = locked && (await lockRsvp(tx, eventId, id));
    if (!locked || previous?.status !== "waitlisted") return undefined;
    const [current] = await tx
      .update(rsvp)
      .set({ status: "going", waitlistedAt: null, promotedAt: now, updatedAt: now })
      .where(eq(rsvp.id, id))
      .returning();
    const mailed = acceptsRsvps(locked.state) && (await queuePromotionMail(locked, [current], tx));
    return { previous, current, mailed };
  });
}

// The host's Approve on a reply waiting for their approval, or on one they declined (spec,
// "Approval"), through the one transaction: the guest is on the list. Nothing for an RSVP already
// approved.
export async function approveRsvp(eventId: string, id: string): Promise<HostChange | undefined> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const locked = await lockEvent(tx, eventId);
    const previous = locked && (await lockRsvp(tx, eventId, id));
    if (!locked || !previous || previous.approval === "approved") return undefined;
    const { current, mailed } = await approveLocked(locked, previous, tx, now);
    return { previous, current, mailed };
  });
}

// Approves every reply still waiting for the host's approval, in the order they arrived, inside
// the caller's transaction and under its lock on the event: what turning approval off does (spec,
// "Approval"; events/repository.ts, updateEvent). Each goes through the path a host's Approve
// takes, so the capacity takes them in that order, and each guest who gave an email is told.
// Whether any email was queued.
export async function approvePending(locked: LockedEvent, tx: Db, now: Date): Promise<boolean> {
  const pending = await tx
    .select()
    .from(rsvp)
    .where(and(eq(rsvp.eventId, locked.id), eq(rsvp.approval, "pending")))
    .orderBy(asc(rsvp.repliedAt), asc(rsvp.id))
    .for("update");
  let mailed = false;
  for (const held of pending) {
    if ((await approveLocked(locked, held, tx, now)).mailed) mailed = true;
  }
  return mailed;
}

// Approving one reply, under the caller's locks on the event and on the reply: it is admitted as a
// new reply to an event without approval would be (a pending or declined reply holds no place), so
// a Going reply is Going when its party fits and waits on the waitlist otherwise; then whoever the
// waitlist has room for is promoted, as after any write. The guest who gave an email, and may come,
// is queued one email while the event takes replies: "You're in", or their place on the waitlist
// (approval-mail.ts).
// On a cancelled event the approval stands, but no email says "You're in" after the notice that
// the event is off.
async function approveLocked(locked: LockedEvent, held: Rsvp, tx: Db, now: Date): Promise<{ current: Rsvp; mailed: boolean }> {
  const admitted = admit({
    approvalRequired: false,
    capacity: locked.capacity,
    headcount: await countHeadcount(locked.id, tx, held.id),
    invited: false,
    wanted: chosenStatus(held.status),
    party: partyOf(held),
  });
  // Admission refuses only a Going guest raising their party, and this reply holds no place yet.
  if ("refused" in admitted) throw new Error(`Approving RSVP ${held.id} was refused by the capacity`);
  const [approved] = await tx
    .update(rsvp)
    .set({ approval: "approved", status: admitted.status, waitlistedAt: waitlistedSince(admitted.status, undefined, now), updatedAt: now })
    .where(eq(rsvp.id, held.id))
    .returning();
  const promotion = await promoteWaitlist(locked, tx, now);
  const current = promotion.promoted.find((each) => each.id === approved.id) ?? approved;
  const told = acceptsRsvps(locked.state) && (await queueApprovalMail(locked, current, tx));
  return { current, mailed: promotion.mailed || told };
}

// The email that tells a guest the host approved them, queued with the write that approved them,
// for a guest who may come (audience.ts, approvalAudience). Whether it was queued.
async function queueApprovalMail(locked: LockedEvent, approved: Rsvp, tx: Db): Promise<boolean> {
  const guests = isMailConfigured() ? approvalAudience([approved]) : [];
  if (guests.length === 0) return false;
  const position = await findWaitlistPosition(approved, tx);
  await queueMail(await guestMails(locked, guests, (guest, t) => approvalMail(locked, guest, position, t)), tx);
  return true;
}

// The host's Decline on a reply waiting for their approval (spec, "Approval"), through the one
// transaction. It held no place, so nobody is promoted, and nobody is emailed (decided there): the
// guest's page says so when they return. Nothing for an RSVP not waiting for approval.
export async function declineRsvp(eventId: string, id: string): Promise<HostChange | undefined> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const locked = await lockEvent(tx, eventId);
    const previous = locked && (await lockRsvp(tx, eventId, id));
    if (!locked || previous?.approval !== "pending") return undefined;
    const [current] = await tx.update(rsvp).set({ approval: "declined", updatedAt: now }).where(eq(rsvp.id, id)).returning();
    return { previous, current, mailed: false };
  });
}

// Scoped to the event, so neither a stale cookie nor another host's page can reach an RSVP. Through
// the one transaction, so the place a Going guest leaves goes to the waitlist. Returns the RSVP
// that went, if there was one, and whether a promotion queued an email.
//
// An RSVP saved through a personal invite leaves the invite unanswered when the guest withdraws
// it: the link is still theirs to reply through. When a host removes it, the invite goes too
// (ticket 08, review): the guest's edit link stops working, as the host is told, and the guest is
// no longer invited; the host makes a new invite to have them back. The row the delete hands back
// still names its invite, though the invite's own reference to it is already gone (set null).
export async function deleteRsvp(eventId: string, id: string, by: "guest" | "host"): Promise<{ removed: Rsvp | undefined; mailed: boolean }> {
  const now = new Date();
  return getDb().transaction(async (tx) => {
    const locked = await lockEvent(tx, eventId);
    if (!locked) return { removed: undefined, mailed: false };
    const [removed] = await tx
      .delete(rsvp)
      .where(and(eq(rsvp.id, id), eq(rsvp.eventId, eventId)))
      .returning();
    if (!removed) return { removed, mailed: false };
    if (by === "host" && removed.inviteId) await tx.delete(invite).where(eq(invite.id, removed.inviteId));
    const { mailed } = await promoteWaitlist(locked, tx, now);
    return { removed, mailed };
  });
}

// The RSVPs of one event as mail to its guests needs them, in the order they replied: who is told
// is decided by the caller (audience.ts), from the status and the approval, the mail is written in
// each guest's language, and a reminder repeats their reply. The reminders read them inside their
// own transaction.
export type MailableRsvp = Pick<Rsvp, "status" | "approval" | "plusOnes" | "email" | "mailToken" | "locale">;

export async function listMailableRsvps(eventId: string, db: Db = getDb()): Promise<MailableRsvp[]> {
  return db
    .select({ status: rsvp.status, approval: rsvp.approval, plusOnes: rsvp.plusOnes, email: rsvp.email, mailToken: rsvp.mailToken, locale: rsvp.locale })
    .from(rsvp)
    .where(eq(rsvp.eventId, eventId))
    .orderBy(asc(rsvp.repliedAt));
}

// What the stop link's page shows (app/m/[token]): the event's title and the email on file, and
// nothing else of the RSVP, which a mail token never reveals or edits.
export async function findByMailToken(mailToken: string): Promise<{ title: string; email: string | null } | undefined> {
  const [row] = await getDb()
    .select({ title: event.title, email: rsvp.email })
    .from(rsvp)
    .innerJoin(event, eq(event.id, rsvp.eventId))
    .where(eq(rsvp.mailToken, mailToken))
    .limit(1);
  return row;
}

// The stop link's one power: blanking the email, so no more mail about the event reaches the
// guest, and its proof with it, and marking when, so a host cannot give them an email again
// (planHostEdit). The token stays, so the link keeps landing on its page. Returns the event's title, or nothing when no
// RSVP has the token.
export async function blankEmailByMailToken(mailToken: string): Promise<{ title: string } | undefined> {
  const [stopped] = await getDb()
    .update(rsvp)
    .set({ email: null, emailVerifiedAt: null, mailStoppedAt: new Date() })
    .from(event)
    .where(and(eq(rsvp.mailToken, mailToken), eq(event.id, rsvp.eventId)))
    .returning({ title: event.title });
  return stopped;
}

// The RSVPs of several events at once, for the host's dashboard. Postgres groups them; the
// headcount rule lives in countRsvps.
export async function countRsvpsByEvent(eventIds: string[]): Promise<Map<string, RsvpCounts>> {
  const counts = new Map<string, RsvpCounts>();
  if (eventIds.length === 0) return counts;
  const rows = await getDb()
    .select({
      eventId: rsvp.eventId,
      status: rsvp.status,
      approval: rsvp.approval,
      rsvps: sql<number>`count(*)::int`,
      plusOnes: sql<number>`coalesce(sum(${rsvp.plusOnes}), 0)::int`,
    })
    .from(rsvp)
    .where(inArray(rsvp.eventId, eventIds))
    .groupBy(rsvp.eventId, rsvp.status, rsvp.approval);

  const tallies = new Map<string, StatusTally[]>();
  for (const { eventId, ...tally } of rows) {
    const forEvent = tallies.get(eventId) ?? [];
    forEvent.push(tally);
    tallies.set(eventId, forEvent);
  }
  for (const eventId of eventIds) counts.set(eventId, countRsvps(tallies.get(eventId) ?? []));
  return counts;
}

// A code sent to an address a guest typed on the event's RSVP form (verification.ts).
export type EmailCode = typeof emailCode.$inferSelect;

// Stores a code just made for an address in place of the one before it, unless that one was made
// less than thirty seconds ago (RESEND_SECONDS). The check is part of the write, so asks that
// arrive together store, and send, one code. Returns the code stored, or nothing when it was too
// soon. Its tries and its time start again, and the code before it no longer works.
export async function createEmailCode(eventId: string, email: string, codeHash: string, expiresAt: Date, db: Db = getDb()): Promise<EmailCode | undefined> {
  const [stored] = await db
    .insert(emailCode)
    .values({ eventId, email, codeHash, expiresAt })
    .onConflictDoUpdate({
      target: [emailCode.eventId, emailCode.email],
      set: { codeHash, expiresAt, attempts: 0, createdAt: sql`now()` },
      setWhere: sql`${emailCode.createdAt} < now() - make_interval(secs => ${RESEND_SECONDS})`,
    })
    .returning();
  return stored;
}

export async function findEmailCode(eventId: string, email: string): Promise<EmailCode | undefined> {
  const [found] = await getDb()
    .select()
    .from(emailCode)
    .where(and(eq(emailCode.eventId, eventId), eq(emailCode.email, email)))
    .limit(1);
  return found;
}

// One more wrong code entered against it. Returns how many there have been.
export async function countAttempt(id: string, db: Db = getDb()): Promise<number> {
  const [counted] = await db
    .update(emailCode)
    .set({ attempts: sql`${emailCode.attempts} + 1` })
    .where(eq(emailCode.id, id))
    .returning({ attempts: emailCode.attempts });
  return counted?.attempts ?? MAX_ATTEMPTS;
}

export async function deleteEmailCode(id: string, db: Db = getDb()): Promise<void> {
  await db.delete(emailCode).where(eq(emailCode.id, id));
}

// What a code the guest typed is worth (codeVerdict), decided under a lock on the code's row, so
// that tries sent at once are counted one after another and a right code is used once: it is
// deleted as it is accepted. A wrong one counts against it, and the guest is told how many tries
// are left. No code for the address is one that has run out.
export async function tryEmailCode(eventId: string, email: string, typed: string, now: Date, secret: string): Promise<{ verdict: CodeVerdict; triesLeft: number }> {
  return getDb().transaction(async (tx) => {
    const [sent] = await tx
      .select()
      .from(emailCode)
      .where(and(eq(emailCode.eventId, eventId), eq(emailCode.email, email)))
      .for("update");
    if (!sent) return { verdict: "expired", triesLeft: 0 };
    const verdict = codeVerdict(sent, typed, now, secret);
    if (verdict === "ok") await deleteEmailCode(sent.id, tx);
    const attempts = verdict === "wrong" ? await countAttempt(sent.id, tx) : sent.attempts;
    return { verdict, triesLeft: Math.max(0, MAX_ATTEMPTS - attempts) };
  });
}

// The mail worker's tidy-up: codes a day old, long dead, whether or not anyone entered them.
export async function deleteStaleEmailCodes(now: Date): Promise<void> {
  await getDb()
    .delete(emailCode)
    .where(lt(emailCode.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
}
