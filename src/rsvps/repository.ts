import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb, type Db } from "@/db/client";
import { emailCode, event, rsvp } from "@/db/schema";
import type { Locale } from "@/locale/resolve-locale";
import { countRsvps, type RsvpCounts, type StatusTally } from "./counts";
import type { RsvpInput, RsvpStatus } from "./form";
import { planHostEdit, planRsvp } from "./plan";
import { generateEditToken, generateMailToken, hashEditToken } from "./token";
import { codeVerdict, MAX_ATTEMPTS, RESEND_SECONDS, type CodeVerdict } from "./verification";

export type Rsvp = typeof rsvp.$inferSelect;

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

// Every RSVP on the event, in any status: what the operator's replies-per-event limit counts.
export async function countEventRsvps(eventId: string, db: Db = getDb()): Promise<number> {
  const [row] = await db.select({ replies: sql<number>`count(*)::int` }).from(rsvp).where(eq(rsvp.eventId, eventId));
  return row.replies;
}

// An RSVP together with the edit token that opened it, which is what the guest holds.
export type MyRsvp = { rsvp: Rsvp; token: string };

// Saves one answer, in the language the guest gave it in. A guest who already has an RSVP here
// changes it and keeps their edit token; anyone else gets a new RSVP with a fresh one. The first
// save with an email makes the RSVP's mail token, and every later save keeps it, even one that
// blanks the email, so the stop link in an old email still finds its page (spec, "Guest mail"). An
// email or phone number the host does not ask for is undefined in the input, and left as stored.
// `proven` says the guest has just entered the code sent to the email they gave (plan.ts).
export async function saveRsvp(eventId: string, input: RsvpInput & { locale: Locale }, mine: MyRsvp | undefined, proven = false): Promise<MyRsvp> {
  const plan = planRsvp(eventId, input, mine && { id: mine.rsvp.id, token: mine.token, email: mine.rsvp.email }, new Date(), proven);
  if (plan.replaces) {
    const mailToken = input.email ? sql`coalesce(${rsvp.mailToken}, ${generateMailToken()})` : undefined;
    const [replaced] = await getDb()
      .update(rsvp)
      .set({ ...plan.changes, locale: input.locale, mailToken })
      .where(eq(rsvp.id, plan.replaces.id))
      .returning();
    return { rsvp: replaced, token: plan.replaces.token };
  }
  const token = generateEditToken();
  const [created] = await getDb()
    .insert(rsvp)
    .values({
      ...plan.rsvp,
      locale: input.locale,
      editTokenHash: hashEditToken(token),
      mailToken: input.email ? generateMailToken() : null,
    })
    .returning();
  return { rsvp: created, token };
}

// The guest list as the host reads it (spec, story 52): everything a host needs to plan. Never
// the edit token, which belongs to the guest alone: the rows reach a client component, so
// anything selected here is serialised into the host's page.
export type HostGuest = {
  id: string;
  name: string;
  status: RsvpStatus;
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
    .orderBy(asc(rsvp.repliedAt));
}

// And as a guest reads it (spec, "RSVP flow"): names, statuses, and how many each is bringing.
// The email and the edit token are never loaded, so they cannot leak into the page even blurred.
export type PublicGuest = { id: string; name: string; status: RsvpStatus; plusOnes: number };

export async function listPublicGuestList(eventId: string): Promise<PublicGuest[]> {
  return getDb()
    .select({ id: rsvp.id, name: rsvp.name, status: rsvp.status, plusOnes: rsvp.plusOnes })
    .from(rsvp)
    .where(eq(rsvp.eventId, eventId))
    .orderBy(asc(rsvp.repliedAt));
}

// A host changing a guest's RSVP on their behalf (spec, story 53, and "Contact details"). It
// writes only what a host may set, so the guest's edit token survives untouched and the link in
// their pocket keeps working, and never an email for a guest who stopped email about the event
// (planHostEdit, decided under the same lock as the write), nor a proven mark on an email the host
// changed. An email the host gives gets the RSVP its mail token, as a guest's does in saveRsvp, so
// every email to it can end with its stop link.
// Returns the RSVP as it was, read under the same lock as the write, so the hosts are told of the
// change that was made (notify-hosts.ts).
export async function editRsvpAsHost(eventId: string, id: string, edit: RsvpInput): Promise<Rsvp | undefined> {
  return getDb().transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(rsvp)
      .where(and(eq(rsvp.id, id), eq(rsvp.eventId, eventId)))
      .for("update");
    if (!previous) return previous;
    const allowed = planHostEdit(edit, previous);
    const mailToken = allowed.email ? sql`coalesce(${rsvp.mailToken}, ${generateMailToken()})` : undefined;
    await tx.update(rsvp).set({ ...allowed, mailToken, updatedAt: new Date() }).where(eq(rsvp.id, id));
    return previous;
  });
}

// Scoped to the event, so neither a stale cookie nor another host's page can reach an RSVP.
// Returns the RSVP that went, if there was one.
export async function deleteRsvp(eventId: string, id: string): Promise<Rsvp | undefined> {
  const [removed] = await getDb().delete(rsvp).where(and(eq(rsvp.id, id), eq(rsvp.eventId, eventId))).returning();
  return removed;
}

// The RSVPs of one event as mail to its guests needs them, in the order they replied: who is told
// is decided by the caller (audience.ts), the mail is written in each guest's language, and a
// reminder repeats their reply. The reminders read them inside their own transaction.
export type MailableRsvp = Pick<Rsvp, "status" | "plusOnes" | "email" | "mailToken" | "locale">;

export async function listMailableRsvps(eventId: string, db: Db = getDb()): Promise<MailableRsvp[]> {
  return db
    .select({ status: rsvp.status, plusOnes: rsvp.plusOnes, email: rsvp.email, mailToken: rsvp.mailToken, locale: rsvp.locale })
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
      rsvps: sql<number>`count(*)::int`,
      plusOnes: sql<number>`coalesce(sum(${rsvp.plusOnes}), 0)::int`,
    })
    .from(rsvp)
    .where(inArray(rsvp.eventId, eventIds))
    .groupBy(rsvp.eventId, rsvp.status);

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
