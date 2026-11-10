import { describe, expect, it } from "vitest";
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "@/retention/plan";
import { atLimit, DEFAULT_LIMITS, LIMIT_MAX, LIMIT_MIN, parseGigabytes, parseLimits, PHOTO_MB, REMINDER_DAYS, STORAGE_GB, VIDEO_MB, VIDEO_MINUTES } from "./limits";

// The M7 fields, valid unless a test says otherwise, so the older tests read as they did.
const M7_FIELDS = { maxPhotoMb: "40", maxVideoMb: "750", maxVideoMinutes: "15", maxEventStorageGb: "50", maxSiteStorageGb: "50", albumReminderDefaultDays: "60", remindNever: false };
const M7 = { maxPhotoMb: 40, maxVideoMb: 750, maxVideoMinutes: 15, maxEventStorageMb: 51200, maxSiteStorageMb: 51200, albumReminderDefaultDays: 60 };

const fields = (maxEventsPerHost: string, maxRsvpsPerEvent: string, retentionDays = "365", keepForever = false, maxPhotosPerEvent = "300") => ({
  maxEventsPerHost,
  maxRsvpsPerEvent,
  maxPhotosPerEvent,
  retentionDays,
  keepForever,
  ...M7_FIELDS,
});

describe("parseLimits", () => {
  it("reads three whole numbers", () => {
    expect(parseLimits(fields("2", "30", "90"))).toEqual({ ok: true, limits: { maxEventsPerHost: 2, maxRsvpsPerEvent: 30, maxPhotosPerEvent: 300, retentionDays: 90, ...M7 } });
  });

  it("takes the smallest and the largest value allowed", () => {
    expect(parseLimits(fields(String(LIMIT_MIN), String(LIMIT_MAX)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: LIMIT_MIN, maxRsvpsPerEvent: LIMIT_MAX, maxPhotosPerEvent: 300, retentionDays: 365, ...M7 },
    });
  });

  it("ignores spaces around a number", () => {
    expect(parseLimits(fields(" 7 ", "8\n", " 60 "))).toEqual({ ok: true, limits: { maxEventsPerHost: 7, maxRsvpsPerEvent: 8, maxPhotosPerEvent: 300, retentionDays: 60, ...M7 } });
  });

  it("refuses a number below the range or above it, naming the field", () => {
    expect(parseLimits(fields("0", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", String(LIMIT_MAX + 1)))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
    expect(parseLimits(fields("-3", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
  });

  it("refuses a decimal, a blank and letters", () => {
    expect(parseLimits(fields("2.5", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", ""))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
    expect(parseLimits(fields("   ", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("ten", "5"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", "1e3"))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
    expect(parseLimits(fields("5", "0x10"))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
  });

  it("names the first field that is wrong", () => {
    expect(parseLimits(fields("x", "y", "z"))).toEqual({ ok: false, field: "maxEventsPerHost" });
    expect(parseLimits(fields("5", "y", "z"))).toEqual({ ok: false, field: "maxRsvpsPerEvent" });
  });

  it("keeps events from 30 days to ten years after they end", () => {
    expect(parseLimits(fields("5", "5", String(RETENTION_MIN_DAYS)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: RETENTION_MIN_DAYS, ...M7 },
    });
    expect(parseLimits(fields("5", "5", String(RETENTION_MAX_DAYS)))).toEqual({
      ok: true,
      limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: RETENTION_MAX_DAYS, ...M7 },
    });
  });

  it("refuses days outside that range, a blank, a decimal and words", () => {
    for (const days of [String(RETENTION_MIN_DAYS - 1), String(RETENTION_MAX_DAYS + 1), "", "45.5", "a year"]) {
      expect(parseLimits(fields("5", "5", days))).toEqual({ ok: false, field: "retentionDays" });
    }
  });

  it("keeps events for ever with Keep forever, whatever the days field holds", () => {
    expect(parseLimits(fields("5", "5", "", true))).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: null, ...M7 } });
    expect(parseLimits(fields("5", "5", "7", true))).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: null, ...M7 } });
  });

  // M7 ticket 01: the upload limits, the storage limits and the album reminder's default.
  it("reads the largest photo and video in MB, the longest video in minutes, storage in GB as whole MB, and the reminder's days", () => {
    const parsed = parseLimits({ ...fields("5", "5"), maxPhotoMb: "100", maxVideoMb: "2000", maxVideoMinutes: "30", maxEventStorageGb: "2", maxSiteStorageGb: "0.5", albumReminderDefaultDays: "90" });
    expect(parsed).toEqual({
      ok: true,
      limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: 365, maxPhotoMb: 100, maxVideoMb: 2000, maxVideoMinutes: 30, maxEventStorageMb: 2048, maxSiteStorageMb: 512, albumReminderDefaultDays: 90 },
    });
  });

  it("refuses each M7 field outside its range, naming it, in the card's order", () => {
    expect(parseLimits({ ...fields("5", "5"), maxPhotoMb: "0" })).toEqual({ ok: false, field: "maxPhotoMb" });
    expect(parseLimits({ ...fields("5", "5"), maxPhotoMb: String(PHOTO_MB.max + 1) })).toEqual({ ok: false, field: "maxPhotoMb" });
    expect(parseLimits({ ...fields("5", "5"), maxVideoMb: String(VIDEO_MB.max + 1) })).toEqual({ ok: false, field: "maxVideoMb" });
    expect(parseLimits({ ...fields("5", "5"), maxVideoMinutes: "0" })).toEqual({ ok: false, field: "maxVideoMinutes" });
    expect(parseLimits({ ...fields("5", "5"), maxVideoMinutes: String(VIDEO_MINUTES.max + 1) })).toEqual({ ok: false, field: "maxVideoMinutes" });
    expect(parseLimits({ ...fields("5", "5"), maxEventStorageGb: "0.001" })).toEqual({ ok: false, field: "maxEventStorageGb" });
    expect(parseLimits({ ...fields("5", "5"), maxSiteStorageGb: "abc" })).toEqual({ ok: false, field: "maxSiteStorageGb" });
    expect(parseLimits({ ...fields("5", "5"), albumReminderDefaultDays: "0" })).toEqual({ ok: false, field: "albumReminderDefaultDays" });
    expect(parseLimits({ ...fields("5", "5"), albumReminderDefaultDays: String(REMINDER_DAYS.max + 1) })).toEqual({ ok: false, field: "albumReminderDefaultDays" });
    // The photo field is wrong before the video field is looked at.
    expect(parseLimits({ ...fields("5", "5"), maxPhotoMb: "x", maxVideoMb: "y" })).toEqual({ ok: false, field: "maxPhotoMb" });
  });

  it("reminds never with Never ticked, whatever the days field holds", () => {
    expect(parseLimits({ ...fields("5", "5"), albumReminderDefaultDays: "", remindNever: true })).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: 365, ...M7, albumReminderDefaultDays: null } });
    expect(parseLimits({ ...fields("5", "5"), albumReminderDefaultDays: "7", remindNever: true })).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 300, retentionDays: 365, ...M7, albumReminderDefaultDays: null } });
  });
});

describe("parseGigabytes", () => {
  it("reads gigabytes, decimals allowed, as whole binary megabytes", () => {
    expect(parseGigabytes("0.01")).toBe(10);
    expect(parseGigabytes("50")).toBe(51200);
    expect(parseGigabytes("1.5")).toBe(1536);
    expect(parseGigabytes(" 2 ")).toBe(2048);
    expect(parseGigabytes(String(STORAGE_GB.max))).toBe(102_400_000);
  });

  it("refuses what is outside the range or not a plain decimal", () => {
    for (const raw of ["0.001", "0", "100000.1", "", "abc", "-1", "1e3", "1,5", ".5"]) {
      expect(parseGigabytes(raw)).toBeUndefined();
    }
  });
});

describe("atLimit", () => {
  it("is false below the limit and true at it or past it", () => {
    expect(atLimit(1, 2)).toBe(false);
    expect(atLimit(2, 2)).toBe(true);
    expect(atLimit(3, 2)).toBe(true);
  });
});

describe("DEFAULT_LIMITS", () => {
  it("is 50 events per host, 500 replies per event, 300 items per album, events kept a year, 40 MB photos, 750 MB and 15 min videos, 50 GB per event and per site, reminders after 60 days", () => {
    expect(DEFAULT_LIMITS).toEqual({ maxEventsPerHost: 50, maxRsvpsPerEvent: 500, maxPhotosPerEvent: 300, retentionDays: 365, ...M7 });
  });

  it("reads the items an album may hold, naming that field when it is out of range (M4 ticket 11)", () => {
    expect(parseLimits(fields("5", "5", "90", false, "12"))).toEqual({ ok: true, limits: { maxEventsPerHost: 5, maxRsvpsPerEvent: 5, maxPhotosPerEvent: 12, retentionDays: 90, ...M7 } });
    expect(parseLimits(fields("5", "5", "90", false, "0"))).toEqual({ ok: false, field: "maxPhotosPerEvent" });
  });
});
