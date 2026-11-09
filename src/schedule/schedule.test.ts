import { describe, expect, it } from "vitest";
import { MAX_ITEMS, MAX_NOTE, MAX_PLACE, MAX_TITLE, parseSchedule, parseScheduleRefresh, sortSchedule, type ScheduleItemInput } from "./schedule";

const row = (fields: Partial<ScheduleItemInput> = {}): ScheduleItemInput => ({
  day: "2027-05-08",
  startTime: "19:00",
  endTime: "",
  title: "Dinner",
  place: "",
  note: "",
  ...fields,
});

const blank = row({ day: "", startTime: "", title: "" });

describe("parseSchedule", () => {
  it("keeps an item as typed, with an end, a place and a note", () => {
    expect(parseSchedule([row({ endTime: "21:00", place: "The garden", note: "Bring a jumper" })])).toEqual({
      ok: true,
      items: [{ day: "2027-05-08", startTime: "19:00", endTime: "21:00", title: "Dinner", place: "The garden", note: "Bring a jumper", position: 0 }],
    });
  });

  it("leaves out rows whose every field is blank, and keeps an empty schedule", () => {
    const parsed = parseSchedule([blank, row(), row({ day: " ", startTime: "", title: "  ", place: " ", note: "\n" })]);
    expect(parsed.ok && parsed.items.map((item) => item.title)).toEqual(["Dinner"]);
    expect(parseSchedule([])).toEqual({ ok: true, items: [] });
    expect(parseSchedule([blank])).toEqual({ ok: true, items: [] });
  });

  it("trims every field, and an end left blank is none", () => {
    const parsed = parseSchedule([row({ day: " 2027-05-08 ", startTime: " 19:00 ", endTime: "  ", title: "  Dinner ", place: " Garden ", note: " Jumper\n" })]);
    expect(parsed).toEqual({ ok: true, items: [{ day: "2027-05-08", startTime: "19:00", endTime: null, title: "Dinner", place: "Garden", note: "Jumper", position: 0 }] });
  });

  it("keeps the minutes of a time a field gives with its seconds", () => {
    expect(parseSchedule([row({ startTime: "19:00:00", endTime: "21:30:00.000" })])).toMatchObject({ ok: true, items: [{ startTime: "19:00", endTime: "21:30" }] });
  });

  it("puts the items in day-and-time order, whatever order they were typed in", () => {
    const parsed = parseSchedule([
      row({ day: "2027-05-09", startTime: "10:00", title: "Brunch" }),
      row({ day: "2027-05-08", startTime: "21:00", title: "Cake" }),
      row({ day: "2027-05-08", startTime: "19:00", title: "Dinner" }),
    ]);
    expect(parsed.ok && parsed.items.map(({ title, position }) => [title, position])).toEqual([
      ["Dinner", 0],
      ["Cake", 1],
      ["Brunch", 2],
    ]);
  });

  it("keeps two items at one time in the order they were typed", () => {
    const parsed = parseSchedule([row({ startTime: "20:00", title: "Toasts" }), row({ startTime: "19:00", title: "Dinner" }), row({ startTime: "20:00", title: "Cake" })]);
    expect(parsed.ok && parsed.items.map((item) => item.title)).toEqual(["Dinner", "Toasts", "Cake"]);
  });

  it(`takes ${MAX_ITEMS} items and refuses one more`, () => {
    const items = (count: number) => Array.from({ length: count }, (_, index) => row({ title: `Item ${index + 1}` }));
    const fifty = parseSchedule(items(MAX_ITEMS));
    expect(fifty.ok && fifty.items).toHaveLength(MAX_ITEMS);
    expect(parseSchedule(items(MAX_ITEMS + 1))).toEqual({ ok: false, error: "scheduleTooMany" });
  });

  it("refuses each mistake, naming the row it is on as the host sees it", () => {
    const second = (fields: Partial<ScheduleItemInput>) => parseSchedule([row(), row(fields)]);
    expect(second({ day: "" })).toEqual({ ok: false, error: "scheduleDayInvalid", n: 2 });
    expect(second({ day: "2027-02-30" })).toEqual({ ok: false, error: "scheduleDayInvalid", n: 2 });
    expect(second({ startTime: "" })).toEqual({ ok: false, error: "scheduleTimeRequired", n: 2 });
    expect(second({ startTime: "25:00" })).toEqual({ ok: false, error: "scheduleTimeInvalid", n: 2 });
    expect(second({ startTime: "19:00junk" })).toEqual({ ok: false, error: "scheduleTimeInvalid", n: 2 });
    expect(second({ endTime: "21:00junk" })).toEqual({ ok: false, error: "scheduleTimeInvalid", n: 2 });
    expect(second({ endTime: "7pm" })).toEqual({ ok: false, error: "scheduleTimeInvalid", n: 2 });
    expect(second({ endTime: "18:30" })).toEqual({ ok: false, error: "scheduleEndBeforeStart", n: 2 });
    expect(second({ title: "  " })).toEqual({ ok: false, error: "scheduleTitleRequired", n: 2 });
    expect(second({ title: "x".repeat(MAX_TITLE + 1) })).toEqual({ ok: false, error: "scheduleTitleTooLong", n: 2 });
    expect(second({ place: "x".repeat(MAX_PLACE + 1) })).toEqual({ ok: false, error: "schedulePlaceTooLong", n: 2 });
    expect(second({ note: "x".repeat(MAX_NOTE + 1) })).toEqual({ ok: false, error: "scheduleNoteTooLong", n: 2 });
  });

  it("counts a blank row the host left in when it names a row", () => {
    expect(parseSchedule([row(), blank, row({ title: "" })])).toEqual({ ok: false, error: "scheduleTitleRequired", n: 3 });
  });

  it("refuses an end equal to its start", () => {
    expect(parseSchedule([row({ startTime: "19:00", endTime: "19:00" })])).toEqual({ ok: false, error: "scheduleEndBeforeStart", n: 1 });
  });

  it("takes the longest title, place and note allowed", () => {
    expect(parseSchedule([row({ title: "x".repeat(MAX_TITLE), place: "x".repeat(MAX_PLACE), note: "x".repeat(MAX_NOTE) })]).ok).toBe(true);
  });

  it("refuses a post of the wrong shape rather than crashing", () => {
    expect(parseSchedule(null)).toEqual({ ok: false, error: "scheduleInvalid" });
    expect(parseSchedule("Dinner at 7")).toEqual({ ok: false, error: "scheduleInvalid" });
    expect(parseSchedule([row(), "Dinner"])).toEqual({ ok: false, error: "scheduleInvalid", n: 2 });
    expect(parseSchedule([{ ...row(), title: 7 }])).toEqual({ ok: false, error: "scheduleInvalid", n: 1 });
    expect(parseSchedule([{ ...row(), note: ["a"] }])).toEqual({ ok: false, error: "scheduleInvalid", n: 1 });
  });
});

describe("sortSchedule", () => {
  it("orders by day, then by start, keeping ties in their order", () => {
    const items = [
      { day: "2027-05-09", startTime: "09:00", title: "a" },
      { day: "2027-05-08", startTime: "20:00", title: "b" },
      { day: "2027-05-08", startTime: "08:00", title: "c" },
      { day: "2027-05-08", startTime: "20:00", title: "d" },
    ];
    expect(sortSchedule(items).map((item) => item.title)).toEqual(["c", "b", "d", "a"]);
    expect(items[0].title).toBe("a");
  });
});

describe("parseScheduleRefresh", () => {
  it("takes either setting and nothing else", () => {
    expect(parseScheduleRefresh("minute")).toBe("minute");
    expect(parseScheduleRefresh("reload")).toBe("reload");
    expect(parseScheduleRefresh("hourly")).toBeUndefined();
    expect(parseScheduleRefresh(undefined)).toBeUndefined();
  });
});
