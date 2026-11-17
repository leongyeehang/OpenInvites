import { describe, expect, it } from "vitest";
import type { Question } from "@/questions/question";
import { DEFAULT_THEME } from "@/themes/theme";
import { duplicateInput } from "./duplicate";
import type { Event } from "./repository";

const source: Event = {
  id: "0194f0a0-0000-7000-8000-000000000001",
  hostId: "owner",
  slug: "abcde12345",
  customSlug: null,
  state: "published",
  title: "Ada’s birthday",
  startsAt: new Date("2027-03-06T11:00:00Z"),
  endsAt: new Date("2027-03-06T14:00:00Z"),
  allDay: false,
  timeZone: "Asia/Singapore",
  location: "Ah Ma’s house",
  description: "Bring nothing.",
  descriptionRich: { blocks: [{ type: "paragraph", spans: [{ text: "Bring nothing." }] }] },
  theme: { ...DEFAULT_THEME, poster: { kind: "upload" }, font: "serif" },
  plusOnesAllowed: 3,
  requirePlusOneNames: true,
  capacity: 30,
  approvalRequired: true,
  emailField: "required",
  phoneField: "optional",
  verifyEmail: true,
  guestListVisibility: "hidden",
  notifyOnRsvp: false,
  locale: "en",
  remindersEnabled: false,
  views: 0,
  publishedAt: new Date("2027-01-01T00:00:00Z"),
  weekReminderSentAt: new Date("2027-02-27T00:00:00Z"),
  dayReminderSentAt: new Date("2027-03-05T00:00:00Z"),
  commentsEnabled: false,
  notifyOnComment: false,
  retentionWarnedAt: new Date("2028-02-05T00:00:00Z"),
  pollOpenedAt: null,
  pollClosedAt: null,
  scheduleRefresh: "reload",
  albumVisibility: "hosts",
  albumApprovalRequired: true,
  notifyOnPhoto: false,
  albumVideosAllowed: false,
  albumMaxVideoMinutes: 3,
  albumMaxVideoMb: 200,
  albumCopySizes: ["720p"],
  albumKeepTakenAt: true,
  albumKeepCamera: true,
  albumOrder: "taken",
  lettersEnabled: true,
  inviteOnly: true,
  albumReminderDays: 90,
  albumRemindedAt: new Date("2027-06-05T00:00:00Z"),
  albumVoting: "closed",
  albumVotingClosesAt: new Date("2027-05-09T12:00:00Z"),
  albumVoters: "invited",
  albumUploaderNames: "never",
  sections: { sections: [{ kind: "album", collapsed: false, heading: "Photos", style: "grid" }] },
  albumEnabled: false,
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
      capacity: 30,
      approvalRequired: true,
      emailField: "required",
      phoneField: "optional",
      verifyEmail: true,
      guestListVisibility: "hidden",
      notifyOnRsvp: false,
      remindersEnabled: false,
      commentsEnabled: false,
      notifyOnComment: false,
      albumVisibility: "hosts",
      albumApprovalRequired: true,
      notifyOnPhoto: false,
    });
  });

  it("keeps personal letters and invite-only, though not the invites themselves", () => {
    expect(copy.event).toMatchObject({ lettersEnabled: true, inviteOnly: true });
  });

  it("keeps the whole look, its poster naming the copy's own picture", () => {
    expect(copy.event.theme).toEqual(source.theme);
  });

  it("keeps the questions in order with their options and required flags, as new ones", () => {
    expect(copy.questions).toEqual([
      { type: "choice", prompt: "Starter?", options: ["Soup", "Salad"], required: true, position: 0 },
      { type: "multiple", prompt: "Which drinks?", options: ["Tea", "Coffee", "Water"], required: false, position: 1 },
      { type: "text", prompt: "Dietary needs?", options: [], required: false, position: 2 },
    ]);
  });

  // M7 ticket 05: the video settings travel with the album's.
  // M8 ticket 02: the video sizes in place of the lighter copy's quality.
  it("copies whether videos are allowed, their caps, and the video sizes", () => {
    expect(copy.event).toMatchObject({ albumVideosAllowed: false, albumMaxVideoMinutes: 3, albumMaxVideoMb: 200, albumCopySizes: ["720p"] });
  });

  // M8 ticket 07: the details the host keeps, and the album's order.
  it("copies whether the capture time and the camera are kept, and the album's order", () => {
    expect(copy.event).toMatchObject({ albumKeepTakenAt: true, albumKeepCamera: true, albumOrder: "taken" });
  });

  // M7 ticket 09: when to be reminded about the album travels with the settings; the mark does not.
  it("copies when to be reminded about the album, and not that the source was", () => {
    expect(copy.event).toMatchObject({ albumReminderDays: 90 });
  });

  // M8 ticket 10: the album vote's settings travel with the album's; the vote itself does not, so
  // the copy starts with voting off (its awards are copied by duplicateEventAction).
  it("copies who may vote and whether guests see who added each item", () => {
    expect(copy.event).toMatchObject({ albumVoters: "invited", albumUploaderNames: "never" });
  });

  // M8 ticket 25: the page's arrangement and the album's own switch (spec, "A duplicated event
  // copies its sections").
  it("copies the sections as arranged and whether the album is on", () => {
    expect(copy.event).toMatchObject({ sections: source.sections, albumEnabled: false });
  });

  it("copies nothing that belongs to the source alone", () => {
    for (const own of ["id", "hostId", "slug", "state", "publishedAt", "weekReminderSentAt", "dayReminderSentAt", "retentionWarnedAt", "pollOpenedAt", "pollClosedAt", "scheduleRefresh", "albumRemindedAt", "albumVoting", "albumVotingClosesAt", "createdAt", "updatedAt"]) {
      expect(copy.event).not.toHaveProperty(own);
    }
  });
});
