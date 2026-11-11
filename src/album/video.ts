import { MEGABYTE, MIN_FREE_BYTES } from "../lib/sizes";

// Videos in the album (M7 spec, "Videos"): what an item is, the files a video is kept as, and the
// caps a clip is held to. Pure; the database enums are built from the lists here.

// An album item is a photo or a video.
export const PHOTO_KINDS = ["photo", "video"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

// The sizes a video's copies are kept at, named by their short side, largest first (M8 ticket 02;
// the database's `video_size` enum is built from this list), and the two a host may tick for an
// event; 4K is the operator's switch (ticket 04, withFourK).
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

// The sizes to make with the operator's 4K copy (M8 ticket 04; spec, "4K copy"): when the switch is
// on, a 4K original that is not H.264, which some browsers cannot play, also gets a 4K H.264 copy,
// first among the sizes; an H.264 original already plays everywhere. Otherwise the host's sizes.
export function withFourK(probe: Probe, ticked: readonly VideoQuality[], on: boolean): VideoQuality[] {
  return on && probe.codec !== "h264" && shortSide(probe) >= TARGET_SHORT_SIDE["2160p"] ? ["2160p", ...ticked] : [...ticked];
}

// How long a copy may take (M8 ticket 04): 30 times the clip's length at 4K and 8 times at the
// other sizes, which a small server's two threads need, and never under an hour.
export function copyTimeoutMs(durationMs: number, size: VideoQuality): number {
  return Math.max(60 * 60_000, durationMs * (size === "2160p" ? 30 : 8));
}

// About how many bytes a copy takes (media part review): its size's bit rate, which the copy is
// capped at, and its sound's (ffmpeg-args.ts, copyArgs), over the clip's length.
const COPY_AUDIO_BITRATE = 128_000;

export function copyEstimateBytes(size: VideoQuality, durationMs: number): number {
  return Math.ceil(((TARGET_BITRATE[size] + COPY_AUDIO_BITRATE) * durationMs) / 8000);
}

// Whether a copy may be started (media part review): only while the free-space floor uploads keep
// (album.ts, storageRoom; MIN_FREE_BYTES) would still be free once it is stored, so Make missing
// sizes, which can queue a copy for every video on the site, never fills the disk. A disk the app
// cannot see (S3) never stops one.
export function roomForCopy(freeBytes: number | undefined, size: VideoQuality, durationMs: number): boolean {
  return freeBytes === undefined || freeBytes - copyEstimateBytes(size, durationMs) >= MIN_FREE_BYTES;
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

// A video's bit rate as the sizes are decided from it: the file as sent over its length, which the
// row keeps (`bytes`, `duration_ms`), so processing and the row read back count the same figure.
function fileBitRate(bytes: number, durationMs: number): number {
  return Math.round((bytes * 8000) / durationMs);
}

// The clip as processing decides its sizes from (media part review): its probe, with the bit rate
// of the file as sent rather than the stream's, the figure probeOfItem gives back once the item is
// stored. Otherwise a video at the margin would be counted, once ready, as lacking a size
// processing chose not to make, and queued again at every press of Make missing sizes.
export function asProcessed<P extends Probe & { durationMs: number }>(probe: P, bytes: number): P {
  return { ...probe, bitRate: fileBitRate(bytes, probe.durationMs) };
}

// The item read back as a probe of its original: the codec string named as ffprobe names it, no
// rotation since the row is stored upright, and the bit rate of the file as sent. Nothing for an
// item not yet measured.
export function probeOfItem(item: VideoItem): Probe | undefined {
  if (item.codec === null || !item.width || !item.height || item.bytes === null || !item.durationMs) return undefined;
  const codec = item.codec.startsWith("avc1") ? "h264" : item.codec.startsWith("hvc1") ? "hevc" : item.codec;
  return { codec, width: item.width, height: item.height, rotation: 0, bitRate: fileBitRate(item.bytes, item.durationMs) };
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

// The size a guest picked in the player (M8 ticket 06; spec, "Remembered pick"): Auto, or a size
// by its short side, the original or a copy. The original whatever its size is an infinite side,
// which M7's "original" meant: on a 4K original this browser cannot decode, it gives the 4K copy.
export type SizePick = "auto" | { side: number; original: boolean };

// Where the pick is kept on the device, for every video on the site; M7's choice of quality, under
// its own key, is read once and then replaced.
export const PICK_KEY = "openinvites.videoSize";
export const OLD_PICK_KEY = "openinvites.videoQuality";

function readNew(raw: string | null): SizePick | undefined {
  if (raw === "auto") return "auto";
  if (raw === "original") return { side: Infinity, original: true };
  const match = /^(\d+)(:original)?$/.exec(raw ?? "");
  const side = Number(match?.[1]);
  return match && side > 0 ? { side, original: match[2] !== undefined } : undefined;
}

// The stored pick: the new key's when it reads, else M7's ("original" the original whatever its
// size, "copy" Auto, which plays a copy wherever one is lighter), else none.
export function readPick(raw: string | null, old: string | null): SizePick | undefined {
  const pick = readNew(raw);
  if (pick) return pick;
  if (old === "original") return { side: Infinity, original: true };
  if (old === "copy") return "auto";
  return undefined;
}

export function formatPick(pick: SizePick): string {
  if (pick === "auto") return "auto";
  if (pick.side === Infinity) return "original";
  return pick.original ? `${pick.side}:original` : String(pick.side);
}

// Sizes in order of side, a copy before an original of the same side: a copy is lighter and plays
// everywhere, so it is the one taken when either would do.
function bySide(order: 1 | -1) {
  return (a: VideoSize, b: VideoSize) => order * (a.side - b.side) || Number(a.original) - Number(b.original);
}

// The size a pick plays, among those this browser plays: the side picked or the nearest below, the
// original or a copy as picked when both have that side, else the smallest above; none when
// nothing plays.
export function pickedSize<Size extends VideoSize>(sizes: Size[], pick: { side: number; original: boolean }, playable: (size: Size) => boolean): Size | undefined {
  const plays = sizes.filter(playable);
  const below = plays.filter((size) => size.side <= pick.side).sort((a, b) => b.side - a.side || Number(b.original === pick.original) - Number(a.original === pick.original));
  return below[0] ?? plays.sort(bySide(1))[0];
}

// What the browser says of its connection (the Network Information API, which Firefox and Safari
// do not have).
export type Connection = { saveData?: boolean; effectiveType?: string; downlink?: number };

// Auto's size (spec, "Auto"), from the sizes this browser plays, picked once when a video opens:
// the smallest under data saver or on 2G; at most 720p on 3G; under 10 Mbit/s, only sizes whose
// bit rate fits in 0.7 of the downlink; the smallest of all when that leaves nothing. Then the
// smallest left that covers 0.9 of the screen's short side in pixels, never more than the video's,
// else the largest left.
export function autoSize<Size extends VideoSize>(sizes: Size[], video: { width: number; height: number }, screen: { width: number; height: number; pixelRatio: number }, net: Connection | undefined): Size | undefined {
  const smallest = [...sizes].sort(bySide(1))[0];
  if (!smallest) return undefined;
  if (net?.saveData || net?.effectiveType === "2g" || net?.effectiveType === "slow-2g") return smallest;
  const downlink = net?.downlink;
  let kept = sizes;
  if (net?.effectiveType === "3g") kept = kept.filter((size) => size.side <= 720);
  if (downlink !== undefined && downlink < 10) kept = kept.filter((size) => size.bitRate <= 0.7 * downlink * 1e6);
  if (kept.length === 0) return smallest;
  const target = Math.min(shortSide(video), shortSide(screen) * screen.pixelRatio);
  return [...kept].sort(bySide(1)).find((size) => size.side >= 0.9 * target) ?? [...kept].sort(bySide(-1))[0];
}

// A wait for data while a video plays, in milliseconds on one clock (the player uses the page's
// monotonic one); `until` once it ended.
export type Wait = { at: number; until?: number };

// Auto steps down when a video stalls three times in a minute, or once for six seconds.
export function shouldStepDown(waits: Wait[], now: number): boolean {
  return waits.filter((wait) => now - wait.at < 60_000).length >= 3 || waits.some((wait) => wait.until === undefined && now - wait.at >= 6000);
}

// The waits with the one still open ended at `now`: playback resumed, the guest paused (a paused
// video is not stalling), or the source was emptied (M8 ticket 07, from ticket 06's review).
export function endWait<W extends Wait>(waits: W[], now: number): W[] {
  return waits.map((wait) => (wait.until === undefined ? { ...wait, until: now } : wait));
}

// The waits still counted: one open, and those begun within the minute; the rest no rule reads, and
// the player drops them, with their checks, rather than keep one for every wait a video ever had.
export function recentWaits<W extends Wait>(waits: W[], now: number): W[] {
  return waits.filter((wait) => wait.until === undefined || now - wait.at < 60_000);
}

// The size Auto steps down to: the largest with a smaller side, since a copy of the same side as
// a stalling original would stall as well; none below the smallest.
export function stepDown<Size extends VideoSize>(sizes: Size[], current: VideoSize): Size | undefined {
  return sizes.filter((size) => size.side < current.side).sort(bySide(-1))[0];
}

// Whether this browser plays the original, asked of its own player with the codec string the
// item recorded; the player answers "probably", "maybe" or nothing.
export function playable(codecString: string, canPlayType: (type: string) => string): boolean {
  return canPlayType(`video/mp4; codecs="${codecString}"`) !== "";
}

// What a failed video's tile is told of why (media part review): the length cap, which it names,
// or nothing. The processor's own text (ffmpeg's last lines, which can hold the server's scratch
// path) stays in the database and the log.
export function shownFailure(failure: string | null): "tooLong" | null {
  return failure === "tooLong" ? "tooLong" : null;
}

// Who processes videos, for the Storage card (ticket 08): the app itself, or the worker container,
// which reports every minute; a worker not heard from for five minutes is missing.
export const WORKER_STALE_MS = 5 * 60_000;

export function videoProcessor(mode: "app" | "worker", seenAt: Date | undefined, now: Date): "app" | "worker" | "missing" {
  if (mode === "app") return "app";
  return seenAt && now.getTime() - seenAt.getTime() < WORKER_STALE_MS ? "worker" : "missing";
}
