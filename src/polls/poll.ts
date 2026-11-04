import type { EventState } from "@/events/repository";

// The date poll (M4 ticket 09): a host who has not fixed a date offers two to six candidates,
// guests vote Yes, If need be or No on each with their name, and the host picks one, which becomes
// the event's date and closes the poll for good.

export const VOTE_ANSWERS = ["yes", "ifNeedBe", "no"] as const;
export type VoteAnswer = (typeof VOTE_ANSWERS)[number];

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

// A candidate as the host types it: a day ("2027-05-08"), and optionally a start and an end time
// on it ("19:00"), in the event's zone.
export type OptionInput = { day: string; startTime: string; endTime: string };

// A candidate as kept.
export type PollOption = { id: string; day: string; startTime: string | null; endTime: string | null };

export type PollError = "pollTooFew" | "pollTooMany" | "pollDayInvalid" | "pollTimeInvalid" | "pollEndBeforeStart" | "pollDuplicate";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// The candidates as typed, in order: blank rows left out, then two to six, each a real day, each
// time "HH:MM", an end only after a start and later than it, and no candidate twice.
export function parseOptions(posted: OptionInput[]): { ok: true; options: Omit<PollOption, "id">[] } | { ok: false; error: PollError } {
  const rows = posted
    .map((row) => ({ day: row.day.trim(), startTime: row.startTime.trim().slice(0, 5), endTime: row.endTime.trim().slice(0, 5) }))
    .filter((row) => row.day || row.startTime || row.endTime);
  if (rows.length < MIN_OPTIONS) return { ok: false, error: "pollTooFew" };
  if (rows.length > MAX_OPTIONS) return { ok: false, error: "pollTooMany" };
  const seen = new Set<string>();
  const options: Omit<PollOption, "id">[] = [];
  for (const row of rows) {
    if (!isDay(row.day)) return { ok: false, error: "pollDayInvalid" };
    if ((row.startTime && !TIME.test(row.startTime)) || (row.endTime && !TIME.test(row.endTime))) return { ok: false, error: "pollTimeInvalid" };
    if (row.endTime && (!row.startTime || row.endTime <= row.startTime)) return { ok: false, error: "pollEndBeforeStart" };
    const key = `${row.day} ${row.startTime}`;
    if (seen.has(key)) return { ok: false, error: "pollDuplicate" };
    seen.add(key);
    options.push({ day: row.day, startTime: row.startTime || null, endTime: row.endTime || null });
  }
  return { ok: true, options };
}

export type PollState = "none" | "open" | "closed";

export function pollState(event: { pollOpenedAt: Date | null; pollClosedAt: Date | null }): PollState {
  if (!event.pollOpenedAt) return "none";
  return event.pollClosedAt ? "closed" : "open";
}

// Who may vote: anyone, on a published event whose poll is open. A draft's poll is the host's
// alone until it is published; a cancelled event takes nothing.
export function mayVote(event: { state: EventState; pollOpenedAt: Date | null; pollClosedAt: Date | null }): boolean {
  return event.state === "published" && pollState(event) === "open";
}

// A voter's answers, one for each candidate the poll has, or which candidate is missing one.
export function parseVotes(optionIds: string[], posted: Record<string, unknown>): { ok: true; votes: Map<string, VoteAnswer> } | { ok: false; error: "voteMissing" } {
  const votes = new Map<string, VoteAnswer>();
  for (const id of optionIds) {
    const answer = posted[id];
    if (typeof answer !== "string" || !(VOTE_ANSWERS as readonly string[]).includes(answer)) return { ok: false, error: "voteMissing" };
    votes.set(id, answer as VoteAnswer);
  }
  return { ok: true, votes };
}

// One candidate's votes: the names under each answer, in the order they voted.
export type Tally = { optionId: string; yes: string[]; ifNeedBe: string[]; no: string[] };

export function tally(options: { id: string }[], votes: { optionId: string; voterId: string; answer: VoteAnswer }[], voters: { id: string; name: string }[]): Tally[] {
  const names = new Map(voters.map((voter) => [voter.id, voter.name]));
  const order = new Map(voters.map((voter, index) => [voter.id, index]));
  return options.map((option) => {
    const mine = votes.filter((vote) => vote.optionId === option.id && names.has(vote.voterId)).sort((a, b) => order.get(a.voterId)! - order.get(b.voterId)!);
    const of = (answer: VoteAnswer) => mine.filter((vote) => vote.answer === answer).map((vote) => names.get(vote.voterId)!);
    return { optionId: option.id, yes: of("yes"), ifNeedBe: of("ifNeedBe"), no: of("no") };
  });
}

// The candidates most can make: the most Yes and If need be together, then the most Yes. None while
// nobody has voted.
export function leading(tallies: Tally[]): string[] {
  const score = (each: Tally) => [each.yes.length + each.ifNeedBe.length, each.yes.length] as const;
  const best = tallies.reduce<readonly [number, number]>((top, each) => {
    const [can, sure] = score(each);
    return can > top[0] || (can === top[0] && sure > top[1]) ? [can, sure] : top;
  }, [0, 0]);
  if (best[0] === 0) return [];
  return tallies.filter((each) => score(each)[0] === best[0] && score(each)[1] === best[1]).map((each) => each.optionId);
}

// The date sheet's fields for a picked candidate: an all-day event on its day when it has no start
// time, otherwise from its start to its end, if it has one (events/form.ts reads them).
export function whenOf(option: Pick<PollOption, "day" | "startTime" | "endTime">, timeZone: string) {
  const start = option.startTime?.slice(0, 5);
  const end = option.endTime?.slice(0, 5);
  return { allDay: !start, start: start ? `${option.day}T${start}` : option.day, end: start && end ? `${option.day}T${end}` : "", timeZone };
}
