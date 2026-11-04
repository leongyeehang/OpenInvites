import { describe, expect, it } from "vitest";
import { parseWhen } from "@/events/form";
import { leading, mayVote, parseOptions, parseVotes, pollState, tally, whenOf } from "./poll";

const row = (day: string, startTime = "", endTime = "") => ({ day, startTime, endTime });

describe("parseOptions", () => {
  it("takes two to six candidates in order, leaving blank rows out", () => {
    expect(parseOptions([row("2027-05-08", "19:00", "22:00"), row(""), row("2027-05-09")])).toEqual({
      ok: true,
      options: [
        { day: "2027-05-08", startTime: "19:00", endTime: "22:00" },
        { day: "2027-05-09", startTime: null, endTime: null },
      ],
    });
  });

  it("refuses fewer than two and more than six", () => {
    expect(parseOptions([row("2027-05-08")])).toEqual({ ok: false, error: "pollTooFew" });
    expect(parseOptions(Array.from({ length: 7 }, (_, i) => row(`2027-05-1${i}`)))).toEqual({ ok: false, error: "pollTooMany" });
  });

  it("refuses a day that is not one, a malformed time, an end without a start or before it, and a repeat", () => {
    expect(parseOptions([row("2027-02-30"), row("2027-05-09")])).toEqual({ ok: false, error: "pollDayInvalid" });
    expect(parseOptions([row("2027-05-08", "25:00"), row("2027-05-09")])).toEqual({ ok: false, error: "pollTimeInvalid" });
    expect(parseOptions([row("2027-05-08", "", "22:00"), row("2027-05-09")])).toEqual({ ok: false, error: "pollEndBeforeStart" });
    expect(parseOptions([row("2027-05-08", "19:00", "18:00"), row("2027-05-09")])).toEqual({ ok: false, error: "pollEndBeforeStart" });
    expect(parseOptions([row("2027-05-08", "19:00"), row("2027-05-08", "19:00")])).toEqual({ ok: false, error: "pollDuplicate" });
  });

  it("lets one day be offered at two times", () => {
    expect(parseOptions([row("2027-05-08", "12:00"), row("2027-05-08", "19:00")]).ok).toBe(true);
  });
});

describe("pollState and mayVote", () => {
  const opened = new Date("2027-04-01T00:00:00Z");
  it("reads the poll from when it opened and closed", () => {
    expect(pollState({ pollOpenedAt: null, pollClosedAt: null })).toBe("none");
    expect(pollState({ pollOpenedAt: opened, pollClosedAt: null })).toBe("open");
    expect(pollState({ pollOpenedAt: opened, pollClosedAt: opened })).toBe("closed");
  });

  it("takes votes only on a published event with an open poll", () => {
    expect(mayVote({ state: "published", pollOpenedAt: opened, pollClosedAt: null })).toBe(true);
    expect(mayVote({ state: "draft", pollOpenedAt: opened, pollClosedAt: null })).toBe(false);
    expect(mayVote({ state: "cancelled", pollOpenedAt: opened, pollClosedAt: null })).toBe(false);
    expect(mayVote({ state: "published", pollOpenedAt: opened, pollClosedAt: opened })).toBe(false);
    expect(mayVote({ state: "published", pollOpenedAt: null, pollClosedAt: null })).toBe(false);
  });
});

describe("parseVotes", () => {
  it("needs an answer on every candidate, and only the three answers", () => {
    expect(parseVotes(["a", "b"], { a: "yes", b: "ifNeedBe", c: "no" })).toEqual({ ok: true, votes: new Map([["a", "yes"], ["b", "ifNeedBe"]]) });
    expect(parseVotes(["a", "b"], { a: "yes" })).toEqual({ ok: false, error: "voteMissing" });
    expect(parseVotes(["a"], { a: "maybe" })).toEqual({ ok: false, error: "voteMissing" });
  });
});

describe("tally and leading", () => {
  const options = [{ id: "sat" }, { id: "sun" }, { id: "mon" }];
  const voters = [
    { id: "v1", name: "Priya" },
    { id: "v2", name: "Mei" },
    { id: "v3", name: "Tom" },
  ];
  const votes = [
    { optionId: "sat", voterId: "v2", answer: "yes" as const },
    { optionId: "sat", voterId: "v1", answer: "yes" as const },
    { optionId: "sun", voterId: "v1", answer: "ifNeedBe" as const },
    { optionId: "sun", voterId: "v2", answer: "yes" as const },
    { optionId: "sun", voterId: "v3", answer: "yes" as const },
    { optionId: "mon", voterId: "v3", answer: "no" as const },
    { optionId: "mon", voterId: "gone", answer: "yes" as const },
  ];

  it("names the voters under each answer, in the order they voted, and skips a voter who is gone", () => {
    expect(tally(options, votes, voters)).toEqual([
      { optionId: "sat", yes: ["Priya", "Mei"], ifNeedBe: [], no: [] },
      { optionId: "sun", yes: ["Mei", "Tom"], ifNeedBe: ["Priya"], no: [] },
      { optionId: "mon", yes: [], ifNeedBe: [], no: ["Tom"] },
    ]);
  });

  it("leads with the most who can make it, then the most who are sure", () => {
    expect(leading(tally(options, votes, voters))).toEqual(["sun"]);
    expect(leading(tally(options, [], voters))).toEqual([]);
    const tied = [
      { optionId: "a", yes: ["x"], ifNeedBe: [], no: [] },
      { optionId: "b", yes: ["y"], ifNeedBe: [], no: [] },
    ];
    expect(leading(tied)).toEqual(["a", "b"]);
  });
});

describe("whenOf", () => {
  it("makes a timed candidate the event's start and end, in its zone", () => {
    const fields = whenOf({ day: "2027-05-08", startTime: "19:00:00", endTime: "22:30:00" }, "Asia/Singapore");
    expect(fields).toEqual({ allDay: false, start: "2027-05-08T19:00", end: "2027-05-08T22:30", timeZone: "Asia/Singapore" });
    const parsed = parseWhen(fields);
    expect(parsed.ok && parsed.when.startsAt.toISOString()).toBe("2027-05-08T11:00:00.000Z");
    expect(parsed.ok && parsed.when.endsAt?.toISOString()).toBe("2027-05-08T14:30:00.000Z");
  });

  it("makes a candidate with no time an all-day event on its day", () => {
    const fields = whenOf({ day: "2027-05-09", startTime: null, endTime: null }, "Europe/London");
    expect(fields).toEqual({ allDay: true, start: "2027-05-09", end: "", timeZone: "Europe/London" });
    const parsed = parseWhen(fields);
    expect(parsed.ok && parsed.when.allDay).toBe(true);
  });
});
