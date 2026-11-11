import { EVENT_SIZES, VIDEO_QUALITIES, type VideoQuality } from "@/album/video";
import { ALBUM_VISIBILITIES, type AlbumVisibility } from "@/album/visibility";
import { VIDEO_MB, VIDEO_MINUTES } from "@/instance/limits";
import { richTextToPlain, type RichText } from "@/rich-text/rich-text";
import { CONTACT_FIELDS, type ContactField } from "@/rsvps/form";
import { GUEST_LIST_VISIBILITIES, type GuestListVisibility } from "@/rsvps/visibility";
import { isTimeZone, toInstant, toWallTime } from "./time";

// What a host fills in, once trusted. Times are instants; the form's wall-clock values are
// converted with the event's zone below.
export type EventInput = {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  timeZone: string;
  location: string;
  description: string;
  descriptionRich: RichText;
  plusOnesAllowed: number;
  requirePlusOneNames: boolean;
  capacity: number | null;
  approvalRequired: boolean;
  emailField: ContactField;
  phoneField: ContactField;
  verifyEmail: boolean;
  guestListVisibility: GuestListVisibility;
  notifyOnRsvp: boolean;
  remindersEnabled: boolean;
  commentsEnabled: boolean;
  notifyOnComment: boolean;
  albumVisibility: AlbumVisibility;
  albumApprovalRequired: boolean;
  notifyOnPhoto: boolean;
  // Videos in the album (M7 ticket 05): whether the event takes them, the host's caps (null: the
  // site's), and the sizes its videos get, largest first (M8 ticket 02).
  albumVideosAllowed: boolean;
  albumMaxVideoMinutes: number | null;
  albumMaxVideoMb: number | null;
  albumCopySizes: VideoQuality[];
  // Only the people on the invite list open the invitation (M6 spec, "Invite-only events").
  inviteOnly: boolean;
};

// What the event form posts, as strings, before any of it is trusted.
export type EventFormFields = {
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  timeZone: string;
  location: string;
  description: RichText;
  plusOnesAllowed: string;
  requirePlusOneNames: boolean;
  capacity: string;
  approvalRequired: boolean;
  emailField: string;
  phoneField: string;
  verifyEmail: boolean;
  guestListVisibility: string;
  notifyOnRsvp: boolean;
  remindersEnabled: boolean;
  commentsEnabled: boolean;
  notifyOnComment: boolean;
  albumVisibility: string;
  albumApprovalRequired: boolean;
  notifyOnPhoto: boolean;
  albumVideosAllowed: boolean;
  albumMaxVideoMinutes: string;
  albumMaxVideoMb: string;
  albumCopySizes: string[];
  inviteOnly: boolean;
};

// How many people one guest may bring at most (spec, "Per-event settings").
export const MAX_PLUS_ONES = 10;

// The capacity a host may set, when they set one (spec, "Capacity and the waitlist").
export const CAPACITY_MIN = 1;
export const CAPACITY_MAX = 5000;

export type EventFormError =
  | "titleRequired"
  | "startRequired"
  | "startInvalid"
  | "endInvalid"
  | "endBeforeStart"
  | "timeZoneInvalid"
  | "plusOnesAllowedInvalid"
  | "capacityInvalid"
  | "contactFieldInvalid"
  | "guestListVisibilityInvalid"
  | "albumVisibilityInvalid"
  | "albumMaxVideoMinutesInvalid"
  | "albumMaxVideoMbInvalid"
  | "albumSizesInvalid";

export type ParsedEventForm = { ok: true; input: EventInput } | { ok: false; error: EventFormError };

const WALL_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

function parseWall(value: string, allDay: boolean, timeZone: string): Date | undefined {
  if (!WALL_TIME.test(value)) return undefined;
  // An all-day event keeps only the date, whatever the input sent.
  const wall = allDay ? value.slice(0, 10) : value;
  const instant = toInstant(wall, timeZone);
  // Round-tripping catches what the pattern cannot: 30 February, 24:30, or a time the clocks skip.
  if (Number.isNaN(instant.getTime()) || toWallTime(instant, timeZone, { dateOnly: allDay }) !== wall) return undefined;
  return instant;
}

// The rules of the event form (ticket 05): a title, a start, an end after the start, a real zone.
export function parseEventForm(fields: EventFormFields): ParsedEventForm {
  const title = fields.title.trim();
  if (!title) return { ok: false, error: "titleRequired" };
  const when = parseWhen(fields);
  if (!when.ok) return when;
  const settings = parseEventSettings(fields);
  if (!settings.ok) return settings;
  return {
    ok: true,
    input: {
      title,
      ...when.when,
      location: fields.location.trim(),
      description: richTextToPlain(fields.description),
      descriptionRich: fields.description,
      ...settings.settings,
    },
  };
}

// When the event happens, as the editor's date sheet and the 0.4 form post it: a start, an end
// after it if any, all day or not, in a real zone.
export type EventWhen = Pick<EventInput, "startsAt" | "endsAt" | "allDay" | "timeZone">;
export type WhenFields = Pick<EventFormFields, "allDay" | "start" | "end" | "timeZone">;

export function parseWhen(fields: WhenFields): { ok: true; when: EventWhen } | { ok: false; error: EventFormError } {
  if (!isTimeZone(fields.timeZone)) return { ok: false, error: "timeZoneInvalid" };
  if (!fields.start) return { ok: false, error: "startRequired" };

  const startsAt = parseWall(fields.start, fields.allDay, fields.timeZone);
  if (!startsAt) return { ok: false, error: "startInvalid" };

  let endsAt: Date | null = null;
  if (fields.end) {
    const end = parseWall(fields.end, fields.allDay, fields.timeZone);
    if (!end) return { ok: false, error: "endInvalid" };
    // A one-day all-day event needs no end; otherwise the end must come after the start.
    if (fields.allDay && end.getTime() === startsAt.getTime()) endsAt = null;
    else if (end <= startsAt) return { ok: false, error: "endBeforeStart" };
    else endsAt = end;
  }
  return { ok: true, when: { startsAt, endsAt, allDay: fields.allDay, timeZone: fields.timeZone } };
}

// Everything a guest does not see (M4 spec, "Settings sheet"): who may come and bring whom, what
// they are asked, who sees the list and the album, and what is emailed.
export type EventSettings = Omit<EventInput, "title" | "startsAt" | "endsAt" | "allDay" | "timeZone" | "location" | "description" | "descriptionRich">;
export type SettingsFields = Omit<EventFormFields, "title" | "allDay" | "start" | "end" | "timeZone" | "location" | "description">;

export function parseEventSettings(fields: SettingsFields): { ok: true; settings: EventSettings } | { ok: false; error: EventFormError } {
  const plusOnesAllowed = Number(fields.plusOnesAllowed);
  if (!Number.isInteger(plusOnesAllowed) || plusOnesAllowed < 0 || plusOnesAllowed > MAX_PLUS_ONES) {
    return { ok: false, error: "plusOnesAllowedInvalid" };
  }

  const capacity = parseCapacity(fields.capacity);
  if (capacity === undefined) return { ok: false, error: "capacityInvalid" };

  const emailField = CONTACT_FIELDS.find((each) => each === fields.emailField);
  const phoneField = CONTACT_FIELDS.find((each) => each === fields.phoneField);
  if (!emailField || !phoneField) return { ok: false, error: "contactFieldInvalid" };

  const guestListVisibility = GUEST_LIST_VISIBILITIES.find((each) => each === fields.guestListVisibility);
  if (!guestListVisibility) return { ok: false, error: "guestListVisibilityInvalid" };

  const albumVisibility = ALBUM_VISIBILITIES.find((each) => each === fields.albumVisibility);
  if (!albumVisibility) return { ok: false, error: "albumVisibilityInvalid" };

  // The video caps (M7 ticket 05): blank means the site's; a value above the site's is kept as
  // typed, since the effective cap is decided at check time (album/video.ts).
  const albumMaxVideoMinutes = parseOptionalWhole(fields.albumMaxVideoMinutes, VIDEO_MINUTES.min, VIDEO_MINUTES.max);
  if (albumMaxVideoMinutes === undefined) return { ok: false, error: "albumMaxVideoMinutesInvalid" };
  const albumMaxVideoMb = parseOptionalWhole(fields.albumMaxVideoMb, VIDEO_MB.min, VIDEO_MB.max);
  if (albumMaxVideoMb === undefined) return { ok: false, error: "albumMaxVideoMbInvalid" };
  // The video sizes (M8 ticket 02): any of the two a host may tick, none included, kept largest
  // first and each once; 4K is not the host's to tick.
  if (fields.albumCopySizes.some((each) => !EVENT_SIZES.some((size) => size === each))) return { ok: false, error: "albumSizesInvalid" };
  const albumCopySizes = VIDEO_QUALITIES.filter((size) => fields.albumCopySizes.includes(size));

  return {
    ok: true,
    settings: {
      plusOnesAllowed,
      requirePlusOneNames: fields.requirePlusOneNames,
      capacity,
      approvalRequired: fields.approvalRequired,
      emailField,
      phoneField,
      verifyEmail: fields.verifyEmail,
      guestListVisibility,
      notifyOnRsvp: fields.notifyOnRsvp,
      remindersEnabled: fields.remindersEnabled,
      commentsEnabled: fields.commentsEnabled,
      notifyOnComment: fields.notifyOnComment,
      albumVisibility,
      albumApprovalRequired: fields.albumApprovalRequired,
      notifyOnPhoto: fields.notifyOnPhoto,
      albumVideosAllowed: fields.albumVideosAllowed,
      albumMaxVideoMinutes,
      albumMaxVideoMb,
      albumCopySizes,
      inviteOnly: fields.inviteOnly,
    },
  };
}

// The album's settings, the videos' among them, which the Settings sheet leaves out while the
// operator has the Album or Videos switched off (M8 ticket 01).
const VIDEO_SETTINGS = ["albumVideosAllowed", "albumMaxVideoMinutes", "albumMaxVideoMb", "albumCopySizes"] as const;
const ALBUM_SETTINGS = ["albumVisibility", "albumApprovalRequired", "notifyOnPhoto", ...VIDEO_SETTINGS] as const;
export type AlbumSettingsField = (typeof ALBUM_SETTINGS)[number];

// What the sheet posted, with each group it left out taken from what the event has, written as the
// sheet would post it, so that saving keeps the event's values for it. Otherwise saving with the
// album off would turn its approval off, and with that approve every photo that waits.
export function keptSettings(posted: SettingsFields, stored: Pick<EventSettings, AlbumSettingsField>, on: { album: boolean; videos: boolean }): SettingsFields {
  const kept = !on.album ? ALBUM_SETTINGS : !on.videos ? VIDEO_SETTINGS : [];
  const asPosted = (value: string | number | boolean | null | readonly string[]) => (typeof value === "boolean" ? value : value === null ? "" : Array.isArray(value) ? [...value] : String(value));
  return { ...posted, ...Object.fromEntries(kept.map((field) => [field, asPosted(stored[field])])) };
}

// A capacity is a whole number written in digits, within the range; empty is no capacity at all.
// Undefined when it is neither.
function parseCapacity(raw: string): number | null | undefined {
  return parseOptionalWhole(raw, CAPACITY_MIN, CAPACITY_MAX);
}

// A whole number written in digits, within the range; empty is none. Undefined when it is neither.
function parseOptionalWhole(raw: string, min: number, max: number): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value >= min && value <= max ? value : undefined;
}
