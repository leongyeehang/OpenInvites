import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

const link = "https://invites.example/e/aB3xY9kLmQ";
const stamped = new Date("2026-09-22T12:00:00Z");

const party = {
  id: "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  title: "Ada’s birthday",
  startsAt: new Date("2027-03-06T11:00:00Z"), // 19:00 in Singapore
  endsAt: new Date("2027-03-06T14:00:00Z"),
  allDay: false,
  timeZone: "Asia/Singapore",
  location: "Ah Ma’s house, 3rd floor",
  description: "Bring nothing.",
};

const lines = (ics: string) => ics.split("\r\n");

describe("buildIcs", () => {
  it("writes a timed event at the instant it happens, whatever zone it was typed in", () => {
    expect(lines(buildIcs(party, link, stamped))).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//OpenInvites//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b@openinvites",
      "DTSTAMP:20260922T120000Z",
      "DTSTART:20270306T110000Z",
      "DTEND:20270306T140000Z",
      "SUMMARY:Ada’s birthday",
      "LOCATION:Ah Ma’s house\\, 3rd floor",
      "DESCRIPTION:Bring nothing.\\n\\nhttps://invites.example/e/aB3xY9kLmQ",
      "URL:https://invites.example/e/aB3xY9kLmQ",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("puts an event typed in another zone at the same instant", () => {
    // 19:00 in New York on the same date is 00:00 UTC the next day.
    const newYork = { ...party, startsAt: new Date("2027-03-07T00:00:00Z"), endsAt: null, timeZone: "America/New_York" };
    expect(lines(buildIcs(newYork, link, stamped))).toContain("DTSTART:20270307T000000Z");
    // A host who did not say when it ends is not made to invent one.
    expect(buildIcs(newYork, link, stamped)).not.toContain("DTEND");
  });

  it("writes an all-day event as dates in the event's own zone, ending the day after", () => {
    const beach = {
      ...party,
      allDay: true,
      startsAt: new Date("2027-04-09T16:00:00Z"), // midnight on the 10th in Singapore
      endsAt: null,
    };
    const written = lines(buildIcs(beach, link, stamped));
    expect(written).toContain("DTSTART;VALUE=DATE:20270410");
    expect(written).toContain("DTEND;VALUE=DATE:20270411");
  });

  it("spans an all-day event's last day, so a two-day event ends on the third", () => {
    const festival = {
      ...party,
      allDay: true,
      startsAt: new Date("2027-04-09T16:00:00Z"),
      endsAt: new Date("2027-04-10T16:00:00Z"),
    };
    expect(lines(buildIcs(festival, link, stamped))).toContain("DTEND;VALUE=DATE:20270412");
  });

  it("escapes what iCalendar reserves, and folds lines nobody should have to read", () => {
    const wordy = { ...party, description: `Semi; comma, slash \\ and\na line break.\n\n${"x".repeat(120)}` };
    const written = lines(buildIcs(wordy, link, stamped));
    const description = written.findIndex((line) => line.startsWith("DESCRIPTION:"));
    expect(written[description]).toContain("Semi\\; comma\\, slash \\\\ and\\na line break.");
    expect(written[description].length).toBeLessThanOrEqual(75);
    // A folded line continues with a single leading space.
    expect(written[description + 1]).toMatch(/^ /);
  });
});
