import { MEGABYTE } from "../lib/sizes";

// Videos in the album (M7 spec, "Videos"): what an item is, the files a video is kept as, and the
// caps a clip is held to. Pure; the database enums are built from the lists here.

// An album item is a photo or a video.
export const PHOTO_KINDS = ["photo", "video"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

// The sizes a video's copies are kept at, named by their short side, largest first (M8 ticket 02;
// the database's `video_size` enum is built from this list), and the two a host may tick for an
// event; 4K is the operator's (ticket 04).
export const VIDEO_QUALITIES = ["2160p", "1080p", "720p"] as const;
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

export const EVENT_SIZES = ["1080p", "720p"] as const;
export type EventSize = (typeof EVENT_SIZES)[number];

// A video's files, named after the item's id under the uploads route (ticket 04): the original
// (the clip rewrapped, metadata dropped, index in front), a copy at each size it has, a poster
// frame for the player and the album's square thumbnail.
export const VIDEO_FILES = {
  original: { file: "video.mp4", type: "video/mp4" },
  copy2160: { file: "video-2160p.mp4", type: "video/mp4" },
  copy1080: { file: "video-1080p.mp4", type: "video/mp4" },
  copy720: { file: "video-720p.mp4", type: "video/mp4" },
  poster: { file: "video-poster.webp", type: "image/webp" },
  thumb: { file: "video-thumb.webp", type: "image/webp" },
} as const;

export type VideoFile = keyof typeof VIDEO_FILES;

export const VIDEO_FILE_NAMES = Object.keys(VIDEO_FILES) as VideoFile[];

// The clip as uploaded, kept only until processing ends, and never served.
export const SENT_FILE = "video-sent";

export function videoFileNamed(file: string): VideoFile | undefined {
  return VIDEO_FILE_NAMES.find((name) => VIDEO_FILES[name].file === file);
}

export function videoKey(id: string, name: VideoFile): string {
  return `${id}-${VIDEO_FILES[name].file}`;
}

export function sentKey(id: string): string {
  return `${id}-${SENT_FILE}`;
}

export function videoUrl(id: string, name: VideoFile): string {
  return `/uploads/${id}/${VIDEO_FILES[name].file}`;
}

export function copyName(size: VideoQuality): "copy2160" | "copy1080" | "copy720" {
  return size === "2160p" ? "copy2160" : size === "1080p" ? "copy1080" : "copy720";
}

export type VideoCaps = { allowed: boolean; maxBytes: number; maxMs: number };

// The caps a clip is held to on an event (plan ruling 3): the smaller of the event's and the
// site's, the event's blank meaning the site's, decided here at check time rather than refused
// when the host saves, so lowering the site's cap never makes a host's unrelated change fail.
// Videos are allowed only when the site has a usable ffmpeg (album/ffmpeg.ts), the operator has
// Videos switched on (M8 ticket 01; the caller reads the switch), and the event allows them.
export function effectiveVideoCaps(
  event: { albumVideosAllowed: boolean; albumMaxVideoMb: number | null; albumMaxVideoMinutes: number | null },
  site: { maxVideoMb: number; maxVideoMinutes: number; videosAvailable: boolean; videosOn: boolean },
): VideoCaps {
  const megabytes = Math.min(event.albumMaxVideoMb ?? site.maxVideoMb, site.maxVideoMb);
  const minutes = Math.min(event.albumMaxVideoMinutes ?? site.maxVideoMinutes, site.maxVideoMinutes);
  return { allowed: site.videosAvailable && site.videosOn && event.albumVideosAllowed, maxBytes: megabytes * MEGABYTE, maxMs: minutes * 60_000 };
}

// What is wrong with a clip before it is sent or stored: too large, or too long. A length not
// known yet (the browser could not read it) is no problem here; the server's probe judges it.
export function videoProblem(file: { size: number; durationMs: number | undefined }, caps: { maxBytes: number; maxMs: number }): "tooLarge" | "tooLong" | undefined {
  if (file.size > caps.maxBytes) return "tooLarge";
  if (file.durationMs !== undefined && file.durationMs > caps.maxMs) return "tooLong";
  return undefined;
}

// Each size's targets (ticket 06; 4K in M8 ticket 02): the short side and about the bit rate a
// copy is made at, 16 Mbit/s at 4K, 6 at 1080p and 3 at 720p.
export const TARGET_BITRATE: Record<VideoQuality, number> = { "2160p": 16_000_000, "1080p": 6_000_000, "720p": 3_000_000 };
export const TARGET_SHORT_SIDE: Record<VideoQuality, number> = { "2160p": 2160, "1080p": 1080, "720p": 720 };

// What ffprobe says of a clip's video stream.
export type Probe = { codec: string; width: number; height: number; rotation: number; bitRate: number };

// The short side is what a size names, whichever way the phone was held (plan ruling 13).
export function shortSide(probe: { width: number; height: number; rotation?: number }): number {
  return Math.min(probe.width, probe.height);
}

// Whether a clip needs a copy at a size: when it is not H.264, which every browser plays; when its
// short side is over the size's; or when its bit rate is over one and a half times the copy's.
// Otherwise the original serves that size and no CPU is spent.
export function needsCopy(probe: Probe, size: VideoQuality): boolean {
  return probe.codec !== "h264" || shortSide(probe) > TARGET_SHORT_SIDE[size] || probe.bitRate > 1.5 * TARGET_BITRATE[size];
}

// The jobs the processing queue does (M8 ticket 03; the database's `video_work` enum is built from
// this list): `process` turns a clip as sent into a ready item; `sizes` makes the copies the item
// still lacks, one a claim; `motion` is a live photo's clip (ticket 08).
export const VIDEO_WORKS = ["process", "sizes", "motion"] as const;
export type VideoWork = (typeof VIDEO_WORKS)[number];

// A copy's short side: the size's, never larger than the original's, since nothing is upscaled.
export function copySide(probe: { width: number; height: number }, size: VideoQuality): number {
  return Math.min(TARGET_SHORT_SIDE[size], shortSide(probe));
}

// The ticked sizes, largest first, that a clip needs a copy at (M8 spec, "Sizes made"), leaving
// out a size whose copy would come out at the same side as one already kept or taken. The
// original's own side is never compared: an H.264 original far over 1080p's bit rate still gets
// a lighter 1080p copy (plan ruling 7).
function sizesNeeded(probe: Probe, ticked: readonly VideoQuality[], kept: readonly VideoQuality[]): VideoQuality[] {
  const sides = kept.map((size) => copySide(probe, size));
  const taken: VideoQuality[] = [];
  for (const size of VIDEO_QUALITIES) {
    if (!ticked.includes(size) || kept.includes(size) || !needsCopy(probe, size)) continue;
    const side = copySide(probe, size);
    if (sides.includes(side)) continue;
    sides.push(side);
    taken.push(size);
  }
  return taken;
}

export function sizesToMake(probe: Probe, ticked: readonly VideoQuality[]): VideoQuality[] {
  return sizesNeeded(probe, ticked, []);
}

// What is made before the item is ready (M8 spec, "A video is ready as soon as it can play"):
// nothing for H.264, which plays everywhere; otherwise the first size to make, or 720p when the
// host ticked none (plan ruling 6). The other sizes follow as a `sizes` job (jobs.ts).
export function madeBeforeReady(probe: Probe, sizes: readonly VideoQuality[]): VideoQuality[] {
  return probe.codec === "h264" ? [] : sizes.length > 0 ? sizes.slice(0, 1) : ["720p"];
}

// A size's name for a person (M8 spec, "Sizes made"): a short side rounded down to a standard
// name, 2160 and over being 4K, and any side under 360 named by itself.
const LABELS: [number, string][] = [
  [2160, "4K"],
  [1440, "1440p"],
  [1080, "1080p"],
  [720, "720p"],
  [480, "480p"],
  [360, "360p"],
];

export function sizeLabel(side: number): string {
  return LABELS.find(([least]) => side >= least)?.[1] ?? `${side}p`;
}

// A processed video as stored: its original's codec string, size upright, file size as sent,
// length, and the sizes it has copies at.
export type VideoItem = { codec: string | null; width: number | null; height: number | null; bytes: number | null; durationMs: number | null; copies: readonly VideoQuality[] };

// The item read back as a probe of its original: the codec string named as ffprobe names it, no
// rotation since the row is stored upright, and the bit rate of the file as sent. Nothing for an
// item not yet measured.
export function probeOfItem(item: VideoItem): Probe | undefined {
  if (item.codec === null || !item.width || !item.height || item.bytes === null || !item.durationMs) return undefined;
  const codec = item.codec.startsWith("avc1") ? "h264" : item.codec.startsWith("hvc1") ? "hevc" : item.codec;
  return { codec, width: item.width, height: item.height, rotation: 0, bitRate: Math.round((item.bytes * 8000) / item.durationMs) };
}

// The sizes a ready item lacks of those its event asks for now, smallest last; a copy it has
// that the event no longer asks for stays and counts (plan, ticket 03).
export function missingSizes(item: VideoItem, ticked: readonly VideoQuality[]): VideoQuality[] {
  const probe = probeOfItem(item);
  return probe ? sizesNeeded(probe, ticked, item.copies) : [];
}

// One size a video plays at, for the player (ticket 06): the original or a copy, its short side,
// and about its bit rate.
export type VideoSize = { name: "original" | VideoQuality; side: number; original: boolean; bitRate: number };

// The original first, then the copies largest first, whatever order they were stored in.
export function videoSizes(item: VideoItem): VideoSize[] {
  const probe = probeOfItem(item);
  if (!probe) return [];
  const copies = VIDEO_QUALITIES.filter((size) => item.copies.includes(size));
  return [
    { name: "original", side: shortSide(probe), original: true, bitRate: probe.bitRate },
    ...copies.map((size) => ({ name: size, side: copySide(probe, size), original: false, bitRate: TARGET_BITRATE[size] })),
  ];
}

// The player's quality (ticket 07; the maintainer, 2026-11-09): the viewer's own choice, kept on
// the device, rules; a device that never chose gets the lighter copy; without a copy the original
// is all there is; an original the browser cannot play gives way to the copy.
export type PlayQuality = "original" | "copy";

export function chooseQuality(stored: PlayQuality | undefined, originalPlayable: boolean, hasCopy: boolean): PlayQuality {
  if (!hasCopy) return "original";
  if (!originalPlayable) return "copy";
  return stored ?? "copy";
}

// Whether this browser plays the original, asked of its own player with the codec string the
// item recorded; the player answers "probably", "maybe" or nothing.
export function playable(codecString: string, canPlayType: (type: string) => string): boolean {
  return canPlayType(`video/mp4; codecs="${codecString}"`) !== "";
}

// Who processes videos, for the Storage card (ticket 08): the app itself, or the worker container,
// which reports every minute; a worker not heard from for five minutes is missing.
export const WORKER_STALE_MS = 5 * 60_000;

export function videoProcessor(mode: "app" | "worker", seenAt: Date | undefined, now: Date): "app" | "worker" | "missing" {
  if (mode === "app") return "app";
  return seenAt && now.getTime() - seenAt.getTime() < WORKER_STALE_MS ? "worker" : "missing";
}
