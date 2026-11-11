import { toInstant } from "../events/time";
import { plainText, type ExifFacts } from "./exif";
import { sizeLabel, type PhotoKind } from "./video";

// What processing learns of an item beyond its size and length, kept in `photo.details` (M8 ticket
// 05): a video's HDR kind and its frame rate, which the player's HDR mark (ticket 06) and the
// technical line read. Ticket 07 adds a photo's size as added, and the camera and exposure a host
// may keep; the capture time has a column of its own (`photo.taken_at`), which the album may be
// ordered by. The stored files keep none of it: processing drops every piece of metadata, so this
// is all that is left. Where a picture was taken is never read.
export type ItemDetails = {
  hdr?: "hlg" | "pq";
  fps?: number;
  pixels?: { width: number; height: number };
  camera?: { make?: string; model?: string; lens?: string };
  exposure?: { shutter?: string; aperture?: number; iso?: number; focalLength?: number };
};

// A video is HDR when its transfer is HLG (what an iPhone records, Dolby Vision's base layer
// included) or PQ, in ffprobe's words; anything else is standard colour.
export function hdrKind(colorTransfer: string | undefined): "hlg" | "pq" | undefined {
  if (colorTransfer === "arib-std-b67") return "hlg";
  if (colorTransfer === "smpte2084") return "pq";
  return undefined;
}

// A frame rate in ffprobe's words ("30000/1001", "60/1", or a bare number), to two decimals;
// nothing for one it could not tell ("0/0").
export function frameRate(rate: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(rate ?? "");
  if (!match) return undefined;
  const fps = Number(match[1]) / Number(match[2] ?? 1);
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : undefined;
}

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

// What a field keeps of a value: itself when valid, nothing otherwise. Words are cleaned as they
// were when written (exif.ts, plainText), so the read-back is as strict as the write.
const number = (value: unknown) => (positive(value) ? value : undefined);
const whole = (value: unknown) => (positive(value) && Number.isInteger(value) ? value : undefined);
const words = (value: unknown) => (typeof value === "string" ? plainText(value) || undefined : undefined);

// An object of the keys named, each kept as its field makes it, left out when the field gives
// nothing; nothing when no key is kept.
function only<T extends Record<string, unknown>>(raw: unknown, fields: { [K in keyof T]-?: (value: unknown) => T[K] | undefined }): T | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const kept = Object.fromEntries(
    Object.entries(fields).flatMap(([key, field]) => {
      const value = (field as (value: unknown) => unknown)((raw as Record<string, unknown>)[key]);
      return value === undefined ? [] : [[key, value]];
    }),
  );
  return Object.keys(kept).length > 0 ? (kept as T) : undefined;
}

// The column read back: only the keys and values written here are kept, so a row written by a
// later version, or by hand, never reaches a page as something it is not.
export function readDetails(raw: unknown): ItemDetails {
  if (typeof raw !== "object" || raw === null) return {};
  const { hdr, fps, pixels, camera, exposure } = raw as Record<string, unknown>;
  const size = only<{ width: number; height: number }>(pixels, { width: whole, height: whole });
  const kept = {
    camera: only<NonNullable<ItemDetails["camera"]>>(camera, { make: words, model: words, lens: words }),
    exposure: only<NonNullable<ItemDetails["exposure"]>>(exposure, { shutter: words, aperture: number, iso: number, focalLength: number }),
  };
  return {
    ...(hdr === "hlg" || hdr === "pq" ? { hdr } : {}),
    ...(positive(fps) ? { fps } : {}),
    ...(size && Object.keys(size).length === 2 ? { pixels: size } : {}),
    ...(kept.camera ? { camera: kept.camera } : {}),
    ...(kept.exposure ? { exposure: kept.exposure } : {}),
  };
}

// How the album is ordered (M8 ticket 07; the database's `album_order` enum is built from this
// list): by when each item was added, or by when it was taken, which needs the time kept.
export const ALBUM_ORDERS = ["added", "taken"] as const;
export type AlbumOrder = (typeof ALBUM_ORDERS)[number];

// The details the host keeps beyond the picture's own (M8 spec, "Details"), each by a switch of its
// own, both off by default: when an item was taken, and the camera with its lens and exposure.
export type KeepDetails = { takenAt: boolean; camera: boolean };

export function keepDetailsOf(event: { albumKeepTakenAt: boolean; albumKeepCamera: boolean }): KeepDetails {
  return { takenAt: event.albumKeepTakenAt, camera: event.albumKeepCamera };
}

// What the add-photos screen tells a guest before they add anything (media part review): that the
// host keeps when each item was taken, the camera it was taken with, or both; nothing when the
// host keeps neither.
export function keptNotice(keep: KeepDetails): "takenAt" | "camera" | "both" | undefined {
  if (keep.takenAt && keep.camera) return "both";
  if (keep.takenAt) return "takenAt";
  return keep.camera ? "camera" : undefined;
}

const DAY = 24 * 60 * 60 * 1000;
const EARLIEST = Date.UTC(2000, 0, 1);

// A time a phone or camera could have taken a picture at: from 2000 on, and no more than a day
// after processing, so a zeroed or never-set clock (1970, 0000) is no capture time.
function plausible(instant: Date, now: Date): Date | null {
  const at = instant.getTime();
  return Number.isFinite(at) && at >= EARLIEST && at <= now.getTime() + DAY ? instant : null;
}

// The minutes east of UTC an offset says ("+08:00", "-0530", "Z"); nothing for one unreadable.
function offsetMinutes(offset: string): number | undefined {
  if (offset === "Z") return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match || Number(match[2]) > 14 || Number(match[3]) > 59) return undefined;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

// A wall-clock time's parts, checked to be a real date and time.
function wallParts(year: string, month: string, day: string, hour: string, minute: string, second: string): number[] | undefined {
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [y, mo, d, h, mi, s] = parts;
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const real = utc.getUTCFullYear() === y && utc.getUTCMonth() === mo - 1 && utc.getUTCDate() === d && utc.getUTCHours() === h && utc.getUTCMinutes() === mi && utc.getUTCSeconds() === s;
  return real ? parts : undefined;
}

// A capture time as EXIF writes it ("2026:01:10 16:42:05"), with its offset when the camera wrote
// one; without, it is read in the event's zone, where the party was (plan ruling 14). Null for one
// unreadable, before 2000, or more than a day after `now`.
export function takenAtFrom(dateTime: string, offset: string | undefined, timeZone: string, now: Date): Date | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(dateTime.trim());
  const parts = match && wallParts(match[1], match[2], match[3], match[4], match[5], match[6]);
  if (!parts) return null;
  const [y, mo, d, h, mi, s] = parts;
  const minutes = offset === undefined ? undefined : offsetMinutes(offset.trim());
  if (minutes !== undefined) return plausible(new Date(Date.UTC(y, mo - 1, d, h, mi, s) - minutes * 60_000), now);
  const two = (n: number) => String(n).padStart(2, "0");
  const instant = toInstant(`${y}-${two(mo)}-${two(d)}T${two(h)}:${two(mi)}`, timeZone);
  return plausible(new Date(instant.getTime() + s * 1000), now);
}

// What a photo's EXIF gives the item (exif.ts, readExif, which read only the groups kept): its
// capture time, and its camera and exposure, each left out when nothing of it was read.
export function photoDetails(facts: ExifFacts, timeZone: string, now: Date): { takenAt: Date | null; camera?: ItemDetails["camera"]; exposure?: ItemDetails["exposure"] } {
  const camera = only<NonNullable<ItemDetails["camera"]>>({ make: facts.make, model: facts.model, lens: facts.lens }, { make: words, model: words, lens: words });
  const exposure = only<NonNullable<ItemDetails["exposure"]>>(
    { shutter: facts.exposureTime !== undefined ? shutterOf(facts.exposureTime) : undefined, aperture: facts.fNumber, iso: facts.iso, focalLength: facts.focalLength },
    { shutter: words, aperture: number, iso: number, focalLength: number },
  );
  return {
    takenAt: facts.dateTime ? takenAtFrom(facts.dateTime, facts.offset, timeZone, now) : null,
    ...(camera ? { camera } : {}),
    ...(exposure ? { exposure } : {}),
  };
}

// The keys of a video's format tags that processing keeps (processing.ts, probe): the capture time
// as an iPhone writes it with its offset, the container's creation time in UTC, and the make and
// model as an iPhone or an Android phone writes them. A location tag goes no further than the parse.
export const DETAIL_TAGS = [
  "com.apple.quicktime.creationdate",
  "creation_time",
  "com.apple.quicktime.make",
  "com.apple.quicktime.model",
  "com.android.manufacturer",
  "com.android.model",
] as const;

// An ISO 8601 time as the tags write it ("2026-01-10T16:20:00+0800", "…T08:21:00.000000Z"); one
// with no offset is UTC, as QuickTime's creation time is.
function isoInstant(value: string | undefined, now: Date): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value?.trim() ?? "");
  const parts = match && wallParts(match[1], match[2], match[3], match[4], match[5], match[6]);
  const minutes = match && offsetMinutes(match[7] ?? "Z");
  if (!parts || minutes === undefined || minutes === null) return null;
  const [y, mo, d, h, mi, s] = parts;
  return plausible(new Date(Date.UTC(y, mo - 1, d, h, mi, s) - minutes * 60_000), now);
}

// A string a tag gives, as people read it (exif.ts, plainText); nothing for none.
function tagText(value: string | undefined): string | undefined {
  return plainText(value ?? "") || undefined;
}

// What a video's tags give the item, for the switches kept: its capture time, the creation date
// with its offset first and the creation time after, and its camera. Never the location.
export function videoDetails(tags: Record<string, string>, keep: KeepDetails, now: Date): { takenAt: Date | null; camera?: ItemDetails["camera"] } {
  const takenAt = keep.takenAt ? (isoInstant(tags["com.apple.quicktime.creationdate"], now) ?? isoInstant(tags.creation_time, now)) : null;
  const camera = keep.camera
    ? only<NonNullable<ItemDetails["camera"]>>(
        { make: tagText(tags["com.apple.quicktime.make"] ?? tags["com.android.manufacturer"]), model: tagText(tags["com.apple.quicktime.model"] ?? tags["com.android.model"]) },
        { make: words, model: words, lens: words },
      )
    : undefined;
  return { takenAt, ...(camera ? { camera } : {}) };
}

// A shutter speed as photographers write it: "1/120" under 0.3 s, and from there a decimal, "0.8"
// or "1.5", since a fraction would round to "1/1" or "1/2".
export function shutterOf(seconds: number): string {
  if (seconds < 0.3) return `1/${Math.round(1 / seconds)}`;
  return String(Math.round(seconds * 10) / 10);
}

// The camera, named once: the model alone when its first word is the maker's ("Canon EOS R5",
// NIKON CORPORATION's "NIKON Z 6"), or when the maker is Apple, whose models (iPhone, iPad) are
// known by themselves; the lens after.
export function cameraLine(camera: NonNullable<ItemDetails["camera"]>): string {
  const { make, model, lens } = camera;
  const firstWord = (text: string) => text.trim().split(/\s+/)[0].toLowerCase();
  const named = !make ? model : !model ? make : make === "Apple" || firstWord(model) === firstWord(make) ? model : `${make} ${model}`;
  return [named, lens].filter(Boolean).join(" · ");
}

// One decimal at most, as a lens's numbers are written.
const tenth = (value: number) => String(Math.round(value * 10) / 10);

// The exposure as photographers read it: "f/1.8 · 1/120 s · ISO 80 · 6.9 mm", what is missing left out.
export function exposureLine(exposure: NonNullable<ItemDetails["exposure"]>): string {
  const { aperture, shutter, iso, focalLength } = exposure;
  return [aperture && `f/${tenth(aperture)}`, shutter && `${shutter} s`, iso && `ISO ${iso}`, focalLength && `${tenth(focalLength)} mm`].filter(Boolean).join(" · ");
}

// The facts under an open item (M8 spec, "Technical line"), decided on the server: a photo's size
// as added, or a video's size by name, frame rate, HDR and length; the file size as uploaded when
// it is known; and the camera and exposure only while the host keeps them, so a detail read under a
// switch later turned off stops being shown, though it is not erased. The camera's make and model
// are left out too where this viewer is not shown who added the item (M8 ticket 12), as a camera
// could name its owner; the exposure stays.
export type ShownDetails = ({ kind: "photo"; width: number; height: number } | { kind: "video"; size: string; fps?: number; hdr: boolean; durationMs: number }) & {
  bytes?: number;
  camera?: string;
  exposure?: string;
};

export function shownDetails(
  item: { kind: PhotoKind; width: number | null; height: number | null; bytes: number | null; durationMs: number | null; details: ItemDetails | null },
  event: { albumKeepCamera: boolean },
  nameShown = true,
): ShownDetails {
  const details = item.details ?? {};
  const technical =
    item.kind === "photo"
      ? { kind: "photo" as const, width: details.pixels?.width ?? item.width ?? 0, height: details.pixels?.height ?? item.height ?? 0 }
      : {
          kind: "video" as const,
          size: sizeLabel(Math.min(item.width ?? 0, item.height ?? 0)),
          ...(details.fps !== undefined ? { fps: Math.round(details.fps) } : {}),
          hdr: details.hdr !== undefined,
          durationMs: item.durationMs ?? 0,
        };
  const camera = event.albumKeepCamera && nameShown && details.camera ? cameraLine(details.camera) : "";
  const exposure = event.albumKeepCamera && details.exposure ? exposureLine(details.exposure) : "";
  return { ...technical, ...(item.bytes !== null ? { bytes: item.bytes } : {}), ...(camera ? { camera } : {}), ...(exposure ? { exposure } : {}) };
}

// The order the album is drawn in: by when taken only while the capture time is kept.
export function albumOrderFor(event: { albumKeepTakenAt: boolean; albumOrder: AlbumOrder }): AlbumOrder {
  return event.albumKeepTakenAt ? event.albumOrder : "added";
}

// When an item was taken, in the event's zone as every time on its page is, in the viewer's
// language: "January 10, 2026 at 4:42 PM".
export function formatTaken(instant: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "long", timeStyle: "short" }).format(instant);
}
