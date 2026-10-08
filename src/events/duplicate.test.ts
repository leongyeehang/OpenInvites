import { describe, expect, it } from "vitest";
import type { Question } from "@/questions/question";
import { DEFAULT_THEME } from "@/themes/theme";
import { duplicateInput } from "./duplicate";
import type { Event } from "./repository";

const source: Event = {
  id: "0194f0a0-0000-7000-8000-000000000001",
  hostId: "owner",
  slug: "abcde12345",
  state: "published",
  title: "Ada’s birthday",
  startsAt: new Date("2027-03-06T11:00:00Z"),
  endsAt: new Date("2027-03-06T14:00:00Z"),
  allDay: false,
  timeZone: "Asia/Singapore",
  location: "Ah Ma’s house",
  description: "Bring nothing.",
  descriptionRich: { blocks: [{ type: "paragraph", spans: [{ text: "Bring nothing." }] }] },
  theme: { ...DEFAULT_THEME, backgroundId: "dusk", uploadId: "0194f0a0-0000-7000-8000-0000000000aa", font: "serif" },
  plusOnesAllowed: 3,
  requirePlusOneNames: true,
  askEmail: true,
  guestListVisibility: "hidden",
  notifyOnRsvp: false,
  locale: "en",
  remindersEnabled: false,
  publishedAt: new Date("2027-01-01T00:00:00Z"),
  weekReminderSentAt: new Date("2027-02-27T00:00:00Z"),
  dayReminderSentAt: new Date("2027-03-05T00:00:00Z"),
  commentsEnabled: false,
  notifyOnComment: false,
  createdAt: new Date("2026-12-01T00:00:00Z"),
  updatedAt: new Date("2026-12-02T00:00:00Z"),
};

const questions: Question[] = [
  { id: "q1", type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true },
  { id: "q2", type: "multiple", prompt: "Which drinks?", options: ["Tea", "Coffee", "Water"], required: false },
  { id: "q3", type: "text", prompt: "Dietary needs?", options: [], required: false },
];

describe("duplicateInput", () => {
  const copy = duplicateInput(source, questions, "zh-Hans", "（副本）");

  it("keeps the details, appends the copy suffix to the title, and takes the host's language", () => {
    expect(copy.event).toMatchObject({
      title: "Ada’s birthday （副本）",
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      allDay: false,
      timeZone: "Asia/Singapore",
      location: "Ah Ma’s house",
      description: "Bring nothing.",
      descriptionRich: source.descriptionRich,
      locale: "zh-Hans",
    });
  });

  it("keeps every setting, including the ones changed from their defaults", () => {
    expect(copy.event).toMatchObject({
      plusOnesAllowed: 3,
      requirePlusOneNames: true,
      askEmail: true,
      guestListVisibility: "hidden",
      notifyOnRsvp: false,
      remindersEnabled: false,
      commentsEnabled: false,
      notifyOnComment: false,
    });
  });

  it("keeps the look but leaves the picture to be replaced by the copy's own", () => {
    expect(copy.event.theme).toEqual({ ...source.theme, uploadId: null });
  });

  it("keeps the questions in order with their options and required flags, as new ones", () => {
    expect(copy.questions).toEqual([
      { type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true, position: 0 },
      { type: "multiple", prompt: "Which drinks?", options: ["Tea", "Coffee", "Water"], required: false, position: 1 },
      { type: "text", prompt: "Dietary needs?", options: [], required: false, position: 2 },
    ]);
  });

  it("copies nothing that belongs to the source alone", () => {
    for (const own of ["id", "hostId", "slug", "state", "publishedAt", "weekReminderSentAt", "dayReminderSentAt", "createdAt", "updatedAt"]) {
      expect(copy.event).not.toHaveProperty(own);
    }
  });
});
