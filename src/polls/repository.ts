import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dateOption, dateVote, dateVoter, event } from "@/db/schema";
import type { Locale } from "@/locale/resolve-locale";
import { generateEditToken, generateMailToken, hashEditToken } from "@/rsvps/token";
import type { PollOption, VoteAnswer } from "./poll";

// A time as Postgres gives it ("19:00:00"), as the host typed it ("19:00").
const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);

// An event's candidates, in the order the host listed them.
export async function listOptions(eventId: string): Promise<PollOption[]> {
  const rows = await getDb()
    .select({ id: dateOption.id, day: dateOption.day, startTime: dateOption.startTime, endTime: dateOption.endTime })
    .from(dateOption)
    .where(eq(dateOption.eventId, eventId))
    .orderBy(asc(dateOption.position));
  return rows.map((row) => ({ ...row, startTime: hhmm(row.startTime), endTime: hhmm(row.endTime) }));
}

// Everything the poll's tallies are made of: its candidates, its voters in the order they first
// voted, and their answers.
export async function loadPoll(eventId: string) {
  const db = getDb();
  const [options, voters, votes] = await Promise.all([
    listOptions(eventId),
    db.select({ id: dateVoter.id, name: dateVoter.name }).from(dateVoter).where(eq(dateVoter.eventId, eventId)).orderBy(asc(dateVoter.createdAt), asc(dateVoter.id)),
    db
      .select({ optionId: dateVote.optionId, voterId: dateVote.voterId, answer: dateVote.answer })
      .from(dateVote)
      .innerJoin(dateVoter, eq(dateVoter.id, dateVote.voterId))
      .where(eq(dateVoter.eventId, eventId)),
  ]);
  return { options, voters, votes };
}

export async function countVoters(eventId: string): Promise<number> {
  const [{ voters }] = await getDb().select({ voters: count() }).from(dateVoter).where(eq(dateVoter.eventId, eventId));
  return voters;
}

// Turns the event's date into a poll of these candidates, replacing any it had: no date until one
// is picked. Only while nobody has voted, which the caller has checked; the event's row is locked
// meanwhile, so a vote cannot slip in between.
export async function openPoll(eventId: string, options: Omit<PollOption, "id">[]): Promise<"opened" | "hasVotes"> {
  return getDb().transaction(async (tx) => {
    await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("update");
    const [{ voters }] = await tx.select({ voters: count() }).from(dateVoter).where(eq(dateVoter.eventId, eventId));
    if (voters > 0) return "hasVotes";
    await tx.delete(dateOption).where(eq(dateOption.eventId, eventId));
    await tx.insert(dateOption).values(options.map((option, position) => ({ eventId, ...option, position })));
    const now = new Date();
    await tx
      .update(event)
      .set({ startsAt: null, endsAt: null, allDay: false, pollOpenedAt: now, pollClosedAt: null, updatedAt: now })
      .where(and(eq(event.id, eventId), isNull(event.pollClosedAt)));
    return "opened";
  });
}

// Gives up a poll nobody has voted on, for a date the host sets themselves.
export async function dropUnvotedPoll(eventId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(dateOption).where(eq(dateOption.eventId, eventId));
    await tx.update(event).set({ pollOpenedAt: null, pollClosedAt: null }).where(and(eq(event.id, eventId), isNull(event.pollClosedAt)));
  });
}

// A voter as their device and their edit link find them, with their answers.
export type Voter = { id: string; name: string; email: string | null; votes: Record<string, VoteAnswer> };

export async function findVoterByToken(eventId: string, token: string): Promise<Voter | undefined> {
  const db = getDb();
  const [voter] = await db
    .select({ id: dateVoter.id, name: dateVoter.name, email: dateVoter.email })
    .from(dateVoter)
    .where(and(eq(dateVoter.eventId, eventId), eq(dateVoter.tokenHash, hashEditToken(token))))
    .limit(1);
  if (!voter) return undefined;
  const votes = await db.select({ optionId: dateVote.optionId, answer: dateVote.answer }).from(dateVote).where(eq(dateVote.voterId, voter.id));
  return { ...voter, votes: Object.fromEntries(votes.map((vote) => [vote.optionId, vote.answer])) };
}

// The event a voter's edit link belongs to, for its route to leave the cookie and go there.
export async function findEventForVoterToken(token: string): Promise<{ eventId: string; slug: string; customSlug: string | null } | undefined> {
  const [found] = await getDb()
    .select({ eventId: event.id, slug: event.slug, customSlug: event.customSlug })
    .from(dateVoter)
    .innerJoin(event, eq(event.id, dateVoter.eventId))
    .where(eq(dateVoter.tokenHash, hashEditToken(token)))
    .limit(1);
  return found;
}

// Saves a voter's name, email and answers: the voter this device's token names, or a new one with a
// new token. Returns the token the device keeps. Only while the poll is open, which is checked
// again here, under the event's lock, so a vote never lands after the date is picked.
export async function saveVotes(
  eventId: string,
  token: string | undefined,
  voter: { name: string; email: string | null; locale: Locale },
  votes: Map<string, VoteAnswer>,
): Promise<{ token: string } | "closed"> {
  return getDb().transaction(async (tx) => {
    const [open] = await tx
      .select({ id: event.id })
      .from(event)
      .where(and(eq(event.id, eventId), isNotNull(event.pollOpenedAt), isNull(event.pollClosedAt)))
      .for("update");
    if (!open) return "closed";
    let kept = token;
    let [found] = kept
      ? await tx
          .select({ id: dateVoter.id })
          .from(dateVoter)
          .where(and(eq(dateVoter.eventId, eventId), eq(dateVoter.tokenHash, hashEditToken(kept))))
      : [];
    if (found) {
      await tx.update(dateVoter).set({ ...voter, updatedAt: new Date() }).where(eq(dateVoter.id, found.id));
    } else {
      kept = generateEditToken();
      [found] = await tx
        .insert(dateVoter)
        .values({ eventId, ...voter, tokenHash: hashEditToken(kept), mailToken: generateMailToken() })
        .returning({ id: dateVoter.id });
    }
    await tx.delete(dateVote).where(eq(dateVote.voterId, found.id));
    await tx.insert(dateVote).values([...votes].map(([optionId, answer]) => ({ optionId, voterId: found.id, answer })));
    return { token: kept! };
  });
}

// Sets the event's date to the picked candidate's and closes the poll for good, unless it was
// closed already. Returns the voters who gave an email, to be told, or nothing when the poll was
// not open.
export async function pickDate(
  eventId: string,
  when: { startsAt: Date; endsAt: Date | null; allDay: boolean },
): Promise<{ email: string; mailToken: string; locale: Locale; name: string }[] | undefined> {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const [picked] = await tx
      .update(event)
      .set({ ...when, pollClosedAt: now, updatedAt: now })
      .where(and(eq(event.id, eventId), isNotNull(event.pollOpenedAt), isNull(event.pollClosedAt)))
      .returning({ id: event.id });
    if (!picked) return undefined;
    const voters = await tx
      .select({ email: dateVoter.email, mailToken: dateVoter.mailToken, locale: dateVoter.locale, name: dateVoter.name })
      .from(dateVoter)
      .where(and(eq(dateVoter.eventId, eventId), isNotNull(dateVoter.email)));
    return voters.map((voter) => ({ ...voter, email: voter.email! }));
  });
}

// One candidate of the event's, to pick.
export async function findOption(eventId: string, optionId: string): Promise<PollOption | undefined> {
  const options = await listOptions(eventId);
  return options.find((option) => option.id === optionId);
}

// The stop link of a voter's mail (spec, "Guest mail"): the event's title and the email on file,
// and blanking it.
export async function findVoterByMailToken(mailToken: string): Promise<{ title: string; email: string | null } | undefined> {
  const [row] = await getDb()
    .select({ title: event.title, email: dateVoter.email })
    .from(dateVoter)
    .innerJoin(event, eq(event.id, dateVoter.eventId))
    .where(eq(dateVoter.mailToken, mailToken))
    .limit(1);
  return row;
}

export async function blankVoterEmail(mailToken: string): Promise<{ title: string } | undefined> {
  const [stopped] = await getDb()
    .update(dateVoter)
    .set({ email: null })
    .from(event)
    .where(and(eq(dateVoter.mailToken, mailToken), eq(event.id, dateVoter.eventId)))
    .returning({ title: event.title });
  return stopped;
}

// Whether every candidate id given is one of the event's.
export async function optionsOf(eventId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await getDb()
    .select({ id: dateOption.id })
    .from(dateOption)
    .where(and(eq(dateOption.eventId, eventId), inArray(dateOption.id, ids)));
  return rows.length === ids.length;
}
