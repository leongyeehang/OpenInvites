import { describe, expect, it } from "vitest";
import { keptSettings, parseEventForm, type SettingsFields } from "./form";

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
  capacity: "40",
  approvalRequired: true,
  emailField: "optional",
  phoneField: "none",
  verifyEmail: true,
  guestListVisibility: "afterReply",
  notifyOnRsvp: true,
  remindersEnabled: true,
  commentsEnabled: true,
  notifyOnComment: true,
  albumVisibility: "going",
  albumApprovalRequired: true,
  notifyOnPhoto: false,
  albumVideosAllowed: true,
  albumMaxVideoMinutes: "",
  albumMaxVideoMb: "",
  albumCopySizes: ["1080p", "720p"],
  inviteOnly: true,
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
        capacity: 40,
        approvalRequired: true,
        emailField: "optional",
        phoneField: "none",
        verifyEmail: true,
        guestListVisibility: "afterReply",
        notifyOnRsvp: true,
        remindersEnabled: true,
        commentsEnabled: true,
        notifyOnComment: true,
        albumVisibility: "going",
        albumApprovalRequired: true,
        notifyOnPhoto: false,
        albumVideosAllowed: true,
        albumMaxVideoMinutes: null,
        albumMaxVideoMb: null,
        albumCopySizes: ["1080p", "720p"],
        inviteOnly: true,
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

  it("only takes an album visibility it knows", () => {
    for (const albumVisibility of ["replied", "going", "hosts"]) {
      const parsed = parseEventForm({ ...valid, albumVisibility });
      expect(parsed.ok && parsed.input.albumVisibility).toBe(albumVisibility);
    }
    expect(parseEventForm({ ...valid, albumVisibility: "everyone" })).toEqual({ ok: false, error: "albumVisibilityInvalid" });
  });

  // M7 ticket 05: the video settings. Blank caps mean the site's; a cap above the site's is kept
  // as typed, since the effective cap is decided when a clip is checked (album/video.ts).
  it("reads the video caps as whole numbers, blank for none, and the video sizes", () => {
    const parsed = parseEventForm({ ...valid, albumVideosAllowed: false, albumMaxVideoMinutes: "2", albumMaxVideoMb: "9000", albumCopySizes: ["720p"] });
    expect(parsed.ok && parsed.input).toMatchObject({ albumVideosAllowed: false, albumMaxVideoMinutes: 2, albumMaxVideoMb: 9000, albumCopySizes: ["720p"] });
    const blank = parseEventForm({ ...valid, albumMaxVideoMinutes: " ", albumMaxVideoMb: "" });
    expect(blank.ok && blank.input).toMatchObject({ albumMaxVideoMinutes: null, albumMaxVideoMb: null });
  });

  // M8 ticket 02: the sizes a host ticks, largest first, each once; none is allowed.
  it("reads the ticked video sizes largest first, each once, and none as none", () => {
    const sizes = (albumCopySizes: string[]) => {
      const parsed = parseEventForm({ ...valid, albumCopySizes });
      return parsed.ok && parsed.input.albumCopySizes;
    };
    expect(sizes(["720p", "1080p"])).toEqual(["1080p", "720p"]);
    expect(sizes(["720p"])).toEqual(["720p"]);
    expect(sizes([])).toEqual([]);
    expect(sizes(["720p", "720p"])).toEqual(["720p"]);
  });

  it("refuses a video cap outside its range or not a whole number, and an unknown size, naming each", () => {
    for (const minutes of ["0", "181", "1.5", "two"]) {
      expect(parseEventForm({ ...valid, albumMaxVideoMinutes: minutes })).toEqual({ ok: false, error: "albumMaxVideoMinutesInvalid" });
    }
    for (const mb of ["0", "10001", "-5"]) {
      expect(parseEventForm({ ...valid, albumMaxVideoMb: mb })).toEqual({ ok: false, error: "albumMaxVideoMbInvalid" });
    }
    // 4K is the operator's to make (ticket 04), never a host's to tick.
    expect(parseEventForm({ ...valid, albumCopySizes: ["4k"] })).toEqual({ ok: false, error: "albumSizesInvalid" });
    expect(parseEventForm({ ...valid, albumCopySizes: ["2160p"] })).toEqual({ ok: false, error: "albumSizesInvalid" });
  });

  it("asks for an email and a phone number only in the three ways it knows", () => {
    for (const emailField of ["none", "optional", "required"]) {
      const parsed = parseEventForm({ ...valid, emailField, phoneField: "required" });
      expect(parsed.ok && parsed.input).toMatchObject({ emailField, phoneField: "required" });
    }
    expect(parseEventForm({ ...valid, emailField: "on" })).toEqual({ ok: false, error: "contactFieldInvalid" });
    expect(parseEventForm({ ...valid, phoneField: "" })).toEqual({ ok: false, error: "contactFieldInvalid" });
  });

  it("allows between no plus-ones and ten", () => {
    expect(parseEventForm({ ...valid, plusOnesAllowed: "0" }).ok).toBe(true);
    expect(parseEventForm({ ...valid, plusOnesAllowed: "10" }).ok).toBe(true);
    expect(parseEventForm({ ...valid, plusOnesAllowed: "11" })).toEqual({ ok: false, error: "plusOnesAllowedInvalid" });
    expect(parseEventForm({ ...valid, plusOnesAllowed: "-1" })).toEqual({ ok: false, error: "plusOnesAllowedInvalid" });
    expect(parseEventForm({ ...valid, plusOnesAllowed: "lots" })).toEqual({ ok: false, error: "plusOnesAllowedInvalid" });
  });

  it("takes a capacity from 1 to 5000, and none when left empty", () => {
    for (const [typed, capacity] of [["1", 1], ["5000", 5000], [" 30 ", 30], ["", null], ["  ", null]] as const) {
      const parsed = parseEventForm({ ...valid, capacity: typed });
      expect(parsed.ok && parsed.input.capacity).toBe(capacity);
    }
    for (const typed of ["0", "5001", "-3", "2.5", "1e3", "forty"]) {
      expect(parseEventForm({ ...valid, capacity: typed })).toEqual({ ok: false, error: "capacityInvalid" });
    }
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

// M8 ticket 01: a group the operator's switches leave out of the Settings sheet is posted empty,
// and saving keeps what the event had for it.
describe("keptSettings", () => {
  // What the sheet posts with the album's group left out: its boxes unticked, its fields empty.
  const posted: SettingsFields = {
    plusOnesAllowed: "1",
    requirePlusOneNames: false,
    capacity: "40",
    approvalRequired: true,
    emailField: "optional",
    phoneField: "none",
    verifyEmail: true,
    guestListVisibility: "afterReply",
    notifyOnRsvp: true,
    remindersEnabled: true,
    commentsEnabled: true,
    notifyOnComment: true,
    inviteOnly: true,
    albumVisibility: "",
    albumApprovalRequired: false,
    notifyOnPhoto: false,
    albumVideosAllowed: false,
    albumMaxVideoMinutes: "",
    albumMaxVideoMb: "",
    albumCopySizes: [],
  };
  const stored = {
    albumVisibility: "hosts" as const,
    albumApprovalRequired: true,
    notifyOnPhoto: true,
    albumVideosAllowed: true,
    albumMaxVideoMinutes: 5,
    albumMaxVideoMb: null,
    albumCopySizes: ["720p" as const],
  };

  it("keeps every album field as stored while the album is off, numbers as their digits and none as empty", () => {
    expect(keptSettings(posted, stored, { album: false, videos: true })).toEqual({
      ...posted,
      albumVisibility: "hosts",
      albumApprovalRequired: true,
      notifyOnPhoto: true,
      albumVideosAllowed: true,
      albumMaxVideoMinutes: "5",
      albumMaxVideoMb: "",
      albumCopySizes: ["720p"],
    });
  });

  it("keeps the video fields as stored while videos are off, and takes the rest of the album's as posted", () => {
    const shown = { ...posted, albumVisibility: "going", albumApprovalRequired: false, notifyOnPhoto: true };
    expect(keptSettings(shown, stored, { album: true, videos: false })).toEqual({
      ...shown,
      albumVideosAllowed: true,
      albumMaxVideoMinutes: "5",
      albumMaxVideoMb: "",
      albumCopySizes: ["720p"],
    });
  });

  it("takes everything as posted while both are on", () => {
    expect(keptSettings(posted, stored, { album: true, videos: true })).toEqual(posted);
  });
});
