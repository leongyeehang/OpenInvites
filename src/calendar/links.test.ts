import { describe, expect, it } from "vitest";
import { googleCalendarHref, outlookHref } from "./links";

const link = "https://invites.example/e/aB3xY9kLmQ";
const party = {
  id: "event-1",
  title: "Ada’s birthday",
  startsAt: new Date("2027-03-06T11:00:00Z"),
  endsAt: new Date("2027-03-06T14:00:00Z"),
  allDay: false,
  timeZone: "Asia/Singapore",
  location: "Ah Ma’s house, 3rd floor",
  description: "Bring nothing.",
};

describe("googleCalendarHref", () => {
  it("carries the instants, the title, the place, and the way back to the invitation", () => {
    const url = new URL(googleCalendarHref(party, link));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("dates")).toBe("20270306T110000Z/20270306T140000Z");
    expect(url.searchParams.get("text")).toBe("Ada’s birthday");
    expect(url.searchParams.get("location")).toBe("Ah Ma’s house, 3rd floor");
    expect(url.searchParams.get("details")).toBe(`Bring nothing.\n\n${link}`);
  });

  it("writes an all-day event as the dates it covers in its own zone", () => {
    const beach = { ...party, allDay: true, startsAt: new Date("2027-04-09T16:00:00Z"), endsAt: null };
    expect(new URL(googleCalendarHref(beach, link)).searchParams.get("dates")).toBe("20270410/20270411");
  });
});

describe("outlookHref", () => {
  it("carries the same event in the form Outlook takes", () => {
    const url = new URL(outlookHref(party, link));
    expect(url.searchParams.get("startdt")).toBe("2027-03-06T11:00:00.000Z");
    expect(url.searchParams.get("enddt")).toBe("2027-03-06T14:00:00.000Z");
    expect(url.searchParams.get("subject")).toBe("Ada’s birthday");
    expect(url.searchParams.get("allday")).toBe(null);
  });

  it("flags an all-day event and gives it dates rather than instants", () => {
    const beach = { ...party, allDay: true, startsAt: new Date("2027-04-09T16:00:00Z"), endsAt: null };
    const url = new URL(outlookHref(beach, link));
    expect(url.searchParams.get("allday")).toBe("true");
    expect(url.searchParams.get("startdt")).toBe("2027-04-10");
    expect(url.searchParams.get("enddt")).toBe("2027-04-11");
  });
});
