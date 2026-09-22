import { describe, expect, it } from "vitest";
import { parseEventForm } from "./form";

const valid = {
  title: "Ada’s birthday",
  allDay: false,
  start: "2027-03-06T19:00",
  end: "",
  timeZone: "Asia/Singapore",
  location: "Ah Ma’s house, 3rd floor",
  description: { blocks: [{ type: "paragraph" as const, spans: [{ text: "Bring nothing." }] }] },
  plusOnesAllowed: "1",
  requirePlusOneNames: false,
  askEmail: false,
  guestListVisibility: "afterReply",
};

describe("parseEventForm", () => {
  it("turns wall-clock times in the event's zone into instants", () => {
    expect(parseEventForm(valid)).toEqual({
      ok: true,
      input: {
        title: "Ada’s birthday",
        allDay: false,
        startsAt: new Date("2027-03-06T11:00:00Z"),
        endsAt: null,
        timeZone: "Asia/Singapore",
        location: "Ah Ma’s house, 3rd floor",
        // The document the host wrote, and the plain words derived from it.
        description: "Bring nothing.",
        descriptionRich: valid.description,
        plusOnesAllowed: 1,
        requirePlusOneNames: false,
        askEmail: false,
        guestListVisibility: "afterReply",
      },
    });
  });

  it("requires a title and a start", () => {
    expect(parseEventForm({ ...valid, title: "   " })).toEqual({ ok: false, error: "titleRequired" });
    expect(parseEventForm({ ...valid, start: "" })).toEqual({ ok: false, error: "startRequired" });
    expect(parseEventForm({ ...valid, start: "yesterday" })).toEqual({ ok: false, error: "startInvalid" });
  });

  it("wants the end after the start", () => {
    expect(parseEventForm({ ...valid, end: "2027-03-06T18:00" })).toEqual({ ok: false, error: "endBeforeStart" });
    expect(parseEventForm({ ...valid, end: "2027-03-06T19:00" })).toEqual({ ok: false, error: "endBeforeStart" });
    const result = parseEventForm({ ...valid, end: "2027-03-06T22:00" });
    expect(result.ok && result.input.endsAt?.toISOString()).toBe("2027-03-06T14:00:00.000Z");
  });

  it("stores all-day events as dates at midnight in the zone, with no end on a single day", () => {
    const oneDay = parseEventForm({ ...valid, allDay: true, start: "2027-03-06", end: "2027-03-06" });
    expect(oneDay.ok && oneDay.input).toMatchObject({
      allDay: true,
      startsAt: new Date("2027-03-05T16:00:00Z"),
      endsAt: null,
    });
    const twoDays = parseEventForm({ ...valid, allDay: true, start: "2027-03-06", end: "2027-03-07" });
    expect(twoDays.ok && twoDays.input.endsAt?.toISOString()).toBe("2027-03-06T16:00:00.000Z");
  });

  it("rejects a time zone that is not on the list", () => {
    expect(parseEventForm({ ...valid, timeZone: "Mars/Olympus" })).toEqual({ ok: false, error: "timeZoneInvalid" });
  });

  it("only takes a guest list visibility it knows", () => {
    expect(parseEventForm({ ...valid, guestListVisibility: "sometimes" })).toEqual({
      ok: false,
      error: "guestListVisibilityInvalid",
    });
  });

  it("allows between no plus-ones and ten", () => {
    expect(parseEventForm({ ...valid, plusOnesAllowed: "0" }).ok).toBe(true);
    expect(parseEventForm({ ...valid, plusOnesAllowed: "10" }).ok).toBe(true);
    expect(parseEventForm({ ...valid, plusOnesAllowed: "11" })).toEqual({ ok: false, error: "plusOnesAllowedInvalid" });
    expect(parseEventForm({ ...valid, plusOnesAllowed: "-1" })).toEqual({ ok: false, error: "plusOnesAllowedInvalid" });
    expect(parseEventForm({ ...valid, plusOnesAllowed: "lots" })).toEqual({ ok: false, error: "plusOnesAllowedInvalid" });
  });
});

describe("parseEventForm with times that do not exist", () => {
  it("rejects a date the calendar does not have", () => {
    expect(parseEventForm({ ...valid, start: "2027-02-30T19:00" })).toEqual({ ok: false, error: "startInvalid" });
    expect(parseEventForm({ ...valid, start: "2027-03-06T24:30" })).toEqual({ ok: false, error: "startInvalid" });
  });

  it("rejects a wall-clock time the clocks skip over", () => {
    // New York, 14 March 2027: 02:00 to 03:00 never happens.
    expect(parseEventForm({ ...valid, timeZone: "America/New_York", start: "2027-03-14T02:30" })).toEqual({
      ok: false,
      error: "startInvalid",
    });
  });
});
