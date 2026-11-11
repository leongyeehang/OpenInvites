import { DEFAULT_RETENTION_DAYS, RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "../retention/plan";

// The limits the operator sets on the instance settings page (spec, "Operator limits"): how many
// events a host may own, how many replies and how many photos and videos an event may take, how
// many days after it ends an event is kept (spec, "Retention"; null keeps it for ever), and, since
// M7 (ticket 01), the largest photo and video, the longest video, the storage per event and for
// the site, and how many days after an event its hosts are reminded about its album (null never).
// Each is read at the moment it is checked, so a change takes effect at once.

export type Limits = {
  maxEventsPerHost: number;
  maxRsvpsPerEvent: number;
  maxPhotosPerEvent: number;
  retentionDays: number | null;
  maxPhotoMb: number;
  maxVideoMb: number;
  maxVideoMinutes: number;
  // Storage is kept in whole binary megabytes; the form takes gigabytes (parseGigabytes).
  maxEventStorageMb: number;
  maxSiteStorageMb: number;
  albumReminderDefaultDays: number | null;
};

export const DEFAULT_LIMITS: Limits = {
  maxEventsPerHost: 50,
  maxRsvpsPerEvent: 500,
  maxPhotosPerEvent: 300,
  retentionDays: DEFAULT_RETENTION_DAYS,
  maxPhotoMb: 40,
  maxVideoMb: 750,
  maxVideoMinutes: 15,
  maxEventStorageMb: 50 * 1024,
  maxSiteStorageMb: 50 * 1024,
  albumReminderDefaultDays: 60,
};

export const LIMIT_MIN = 1;
export const LIMIT_MAX = 100_000;
// The ranges of the M7 limits, as the spec sets them.
export const PHOTO_MB = { min: 1, max: 1000 } as const;
export const VIDEO_MB = { min: 1, max: 10_000 } as const;
export const VIDEO_MINUTES = { min: 1, max: 180 } as const;
export const STORAGE_GB = { min: 0.01, max: 100_000 } as const;
export const REMINDER_DAYS = { min: 1, max: 3650 } as const;

// The form's fields as posted. The storage fields are typed in gigabytes.
export type LimitsFields = {
  maxEventsPerHost: string;
  maxRsvpsPerEvent: string;
  maxPhotosPerEvent: string;
  retentionDays: string;
  keepForever: boolean;
  maxPhotoMb: string;
  maxVideoMb: string;
  maxVideoMinutes: string;
  maxEventStorageGb: string;
  maxSiteStorageGb: string;
  albumReminderDefaultDays: string;
  remindNever: boolean;
};

// The field a refusal names; the action turns it into the message `${field}Invalid`.
export type LimitField = Exclude<keyof LimitsFields, "keepForever" | "remindNever">;

export type LimitsParse = { ok: true; limits: Limits } | { ok: false; field: LimitField };

// A limit is a whole number written in digits, within the range: no sign, decimal point or exponent.
function parseLimit(raw: string, min = LIMIT_MIN, max = LIMIT_MAX): number | undefined {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value >= min && value <= max ? value : undefined;
}

// A storage limit as typed, in gigabytes with an optional decimal part, as whole binary megabytes:
// 0.01 GB is 10 MB, which lets a small site be tried with files of a few megabytes.
export function parseGigabytes(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
  const gigabytes = Number(text);
  if (gigabytes < STORAGE_GB.min || gigabytes > STORAGE_GB.max) return undefined;
  return Math.round(gigabytes * 1024);
}

// The form's fields as posted, or the first that is wrong, in the card's order. With Keep forever
// or Never ticked the days are not read: the field is disabled then, and sends nothing.
export function parseLimits(fields: LimitsFields): LimitsParse {
  const maxEventsPerHost = parseLimit(fields.maxEventsPerHost);
  if (maxEventsPerHost === undefined) return { ok: false, field: "maxEventsPerHost" };
  const maxRsvpsPerEvent = parseLimit(fields.maxRsvpsPerEvent);
  if (maxRsvpsPerEvent === undefined) return { ok: false, field: "maxRsvpsPerEvent" };
  // Photos and videos in an event's album (M4 ticket 11, M7).
  const maxPhotosPerEvent = parseLimit(fields.maxPhotosPerEvent);
  if (maxPhotosPerEvent === undefined) return { ok: false, field: "maxPhotosPerEvent" };
  const maxPhotoMb = parseLimit(fields.maxPhotoMb, PHOTO_MB.min, PHOTO_MB.max);
  if (maxPhotoMb === undefined) return { ok: false, field: "maxPhotoMb" };
  const maxVideoMb = parseLimit(fields.maxVideoMb, VIDEO_MB.min, VIDEO_MB.max);
  if (maxVideoMb === undefined) return { ok: false, field: "maxVideoMb" };
  const maxVideoMinutes = parseLimit(fields.maxVideoMinutes, VIDEO_MINUTES.min, VIDEO_MINUTES.max);
  if (maxVideoMinutes === undefined) return { ok: false, field: "maxVideoMinutes" };
  const maxEventStorageMb = parseGigabytes(fields.maxEventStorageGb);
  if (maxEventStorageMb === undefined) return { ok: false, field: "maxEventStorageGb" };
  const maxSiteStorageMb = parseGigabytes(fields.maxSiteStorageGb);
  if (maxSiteStorageMb === undefined) return { ok: false, field: "maxSiteStorageGb" };
  const retentionDays = fields.keepForever ? null : parseLimit(fields.retentionDays, RETENTION_MIN_DAYS, RETENTION_MAX_DAYS);
  if (retentionDays === undefined) return { ok: false, field: "retentionDays" };
  const albumReminderDefaultDays = fields.remindNever ? null : parseLimit(fields.albumReminderDefaultDays, REMINDER_DAYS.min, REMINDER_DAYS.max);
  if (albumReminderDefaultDays === undefined) return { ok: false, field: "albumReminderDefaultDays" };
  return {
    ok: true,
    limits: { maxEventsPerHost, maxRsvpsPerEvent, maxPhotosPerEvent, retentionDays, maxPhotoMb, maxVideoMb, maxVideoMinutes, maxEventStorageMb, maxSiteStorageMb, albumReminderDefaultDays },
  };
}

// Whether one more would go past the limit. A limit lowered below what exists leaves what exists
// alone and refuses anything new.
export function atLimit(count: number, limit: number): boolean {
  return count >= limit;
}
