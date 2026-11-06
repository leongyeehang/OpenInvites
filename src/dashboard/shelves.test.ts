import { describe, expect, it } from "vitest";
import { NO_RSVPS, type RsvpCounts } from "@/rsvps/counts";
import { glowEvent, shelve, tileChip, tileNumber, whenKind, type ShelfEvent } from "./shelves";

const now = new Date("2026-11-06T00:00:00Z");

// An event as the dashboard has it: only the fields the rules read are real.
function event(
  id: string,
  fields: Partial<Omit<ShelfEvent, "counts">> & { counts?: Partial<RsvpCounts> } = {},
): ShelfEvent {
  const { counts, ...rest } = fields;
  return {
    id,
    state: "published",
    role: "owner",
    startsAt: null,
    endsAt: null,
    allDay: false,
    timeZone: "Asia/Singapore",
    capacity: null,
    pollOpenedAt: null,
    pollClosedAt: null,
    deletion: null,
    ...rest,
    counts: { ...NO_RSVPS, ...counts },
  } as ShelfEvent;
}

const day = (iso: string) => new Date(`${iso}T11:00:00Z`);
const ids = (events: ShelfEvent[]) => events.map((each) => each.id);

describe("shelve", () => {
  it("makes the soonest published event Next up, never a sooner draft or cancelled event", () => {
    const shelves = shelve(
      [
        event("party", { startsAt: day("2026-11-20") }),
        event("draft", { state: "draft", startsAt: day("2026-11-10") }),
        event("cancelled", { state: "cancelled", startsAt: day("2026-11-12") }),
        event("later", { startsAt: day("2026-12-01") }),
      ],
      now,
    );
    expect(shelves.nextUp?.id).toBe("party");
    expect(ids(shelves.comingUp)).toEqual(["cancelled", "later"]);
    expect(ids(shelves.drafts)).toEqual(["draft"]);
    expect(shelves.past).toEqual([]);
  });

  it("puts a published event whose date is being voted on after every dated one", () => {
    const voting = event("voting", { pollOpenedAt: day("2026-11-01") });
    expect(shelve([voting, event("dated", { startsAt: day("2026-12-24") })], now).nextUp?.id).toBe("dated");
    expect(shelve([voting], now).nextUp?.id).toBe("voting");
  });

  it("has no Next up when nothing upcoming is published", () => {
    const shelves = shelve([event("draft", { state: "draft" }), event("over", { startsAt: day("2026-10-01") })], now);
    expect(shelves.nextUp).toBeNull();
    expect(ids(shelves.drafts)).toEqual(["draft"]);
  });

  it("keeps drafts in the upcoming order, the undated ones last, and an ended draft under Past", () => {
    const shelves = shelve(
      [
        event("blank", { state: "draft" }),
        event("dec", { state: "draft", startsAt: day("2026-12-05") }),
        event("nov", { state: "draft", startsAt: day("2026-11-15") }),
        event("old", { state: "draft", startsAt: day("2026-01-15") }),
      ],
      now,
    );
    expect(ids(shelves.drafts)).toEqual(["nov", "dec", "blank"]);
    expect(ids(shelves.past)).toEqual(["old"]);
  });

  it("lists Past newest first, and puts no event on two shelves", () => {
    const events = [
      event("sep", { startsAt: day("2026-09-01") }),
      event("oct", { startsAt: day("2026-10-01") }),
      event("next", { startsAt: day("2026-11-20") }),
      event("after", { startsAt: day("2026-11-30") }),
    ];
    const shelves = shelve(events, now);
    expect(ids(shelves.past)).toEqual(["oct", "sep"]);
    const placed = [shelves.nextUp!, ...shelves.comingUp, ...shelves.drafts, ...shelves.past];
    expect(ids(placed).sort()).toEqual(ids(events).sort());
  });
});

describe("whenKind", () => {
  it("says whether an event has a date, a poll still open, or neither", () => {
    expect(whenKind(event("a", { startsAt: day("2026-11-20") }))).toBe("dated");
    expect(whenKind(event("b", { pollOpenedAt: day("2026-11-01") }))).toBe("poll");
    expect(whenKind(event("c", { pollOpenedAt: day("2026-11-01"), pollClosedAt: day("2026-11-03") }))).toBe("none");
    expect(whenKind(event("d", { state: "draft" }))).toBe("none");
  });
});

describe("tileChip", () => {
  it("shows guests waiting for approval before anything else", () => {
    expect(tileChip(event("a", { state: "cancelled", role: "coHost", counts: { pending: 2 } }))).toEqual({ kind: "toApprove", count: 2 });
  });

  it("then a cancelled event, then a draft, then a co-hosted one", () => {
    expect(tileChip(event("a", { state: "cancelled", role: "coHost" }))).toEqual({ kind: "cancelled" });
    expect(tileChip(event("b", { state: "draft", role: "coHost" }))).toEqual({ kind: "draft" });
    expect(tileChip(event("c", { role: "coHost" }))).toEqual({ kind: "coHost" });
    expect(tileChip(event("d"))).toBeNull();
  });
});

describe("tileNumber", () => {
  it("shows the places taken when the event has a capacity, otherwise who is going", () => {
    expect(tileNumber(event("a", { capacity: 12, counts: { headcount: 9, going: 7 } }), "comingUp")).toEqual({ kind: "places", headcount: 9, capacity: 12 });
    expect(tileNumber(event("b", { counts: { going: 26 } }), "drafts")).toEqual({ kind: "going", count: 26 });
  });

  it("says who went on Past, or the day it will be deleted once it is marked", () => {
    expect(tileNumber(event("a", { capacity: 12, counts: { going: 31 } }), "past")).toEqual({ kind: "went", count: 31 });
    const deletion = day("2026-12-03");
    expect(tileNumber(event("b", { deletion, counts: { going: 31 } }), "past")).toEqual({ kind: "deletion", date: deletion });
  });
});

describe("glowEvent", () => {
  it("takes Next up, else the first event on the first shelf that has one", () => {
    const next = event("next", { startsAt: day("2026-11-20") });
    const cancelled = event("cancelled", { state: "cancelled", startsAt: day("2026-11-21") });
    const draft = event("draft", { state: "draft" });
    const past = event("past", { startsAt: day("2026-10-01") });
    expect(glowEvent(shelve([past, draft, cancelled, next], now))?.id).toBe("next");
    expect(glowEvent(shelve([past, draft, cancelled], now))?.id).toBe("cancelled");
    expect(glowEvent(shelve([past, draft], now))?.id).toBe("draft");
    expect(glowEvent(shelve([past], now))?.id).toBe("past");
    expect(glowEvent(shelve([], now))).toBeNull();
  });
});
