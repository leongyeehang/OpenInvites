import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { and, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { getDb } from "@/db/client";
import { event, photo } from "@/db/schema";
import { videoFourKCopy, videoLimits, videoProcessing } from "@/instance/repository";
import { getStorage } from "@/storage/storage";
import { freeDiskBytes } from "@/storage/usage";
import { MAX_PIXELS } from "@/uploads/validate";
import { DETAIL_TAGS, frameRate, hdrKind, keepDetailsOf, videoDetails, type ItemDetails } from "./details";
import { ffmpegStatus } from "./ffmpeg";
import { copyArgs, motionArgs, posterArgs, probeArgs, rewrapArgs } from "./ffmpeg-args";
import { motionKey, motionSentKey, removeItemFiles } from "./files";
import { completeJob, completeMotion, dropJob, failJob, keepLease, releaseJob, renewLease, type ClaimedJob } from "./jobs";
import { notifyHostsOfVideo } from "./notify-hosts";
import { removeDir, scratchDir } from "./tmp";
import { asProcessed, copyName, copyTimeoutMs, effectiveVideoCaps, madeBeforeReady, missingSizes, probeOfItem, roomForCopy, sentKey, sizesToMake, videoKey, withFourK, type Probe, type VideoQuality } from "./video";

// What the queue does to a clip (M7 spec, "Videos"; ADR-0007): reads its streams with ffprobe;
// rewraps it at original quality into MP4 with every piece of metadata dropped and the index in
// front, which is instant since the frames are copied; makes the H.264 copy an original that is
// not H.264 needs to play everywhere, when the site's switch is on; takes a poster frame and the
// album's thumbnail through the same image pipeline as photos; stores all of it; and deletes the
// clip as sent. The other sizes the event asks for (video.ts, sizesToMake) follow from the stored
// original, one a claim, once the item is ready (M8 ticket 03, processSizes). ffmpeg runs at low
// priority with two threads, so the site keeps answering pages. The job's lease is renewed while
// either runs, and a renewal that finds the job gone stops ffmpeg (M8 ticket 04). An HDR clip keeps
// its HDR in the original, while its copies, poster and thumbnail are tone-mapped to standard
// colour when the server's ffmpeg can (M8 ticket 05; ffmpeg-args.ts). A live photo's motion is
// made here too, as a job of its own (M8 ticket 08, processMotion).

// A failure no retry would mend: the item is failed at once, or a live photo's motion given up.
class Final extends Error {}

// The job is no longer this container's: its item was deleted, or its lease lapsed and another
// processor took it. Whatever ran is stopped, and nothing more is done for the job.
export class JobGone extends Error {
  constructor() {
    super("the job is gone");
  }
}

// What the probe tells of a clip: beside the copy decision's Probe, its length, sound and codec
// string, its HDR kind and frame rate (details.ts), whether it carries a Dolby Vision record, and the
// format tags a host's details may be read from (details.ts, DETAIL_TAGS; M8 ticket 07).
type Streams = Probe & { durationMs: number; hasAudio: boolean; codecString: string; hdr: "hlg" | "pq" | undefined; fps: number | undefined; dolbyVision: boolean; tags: Record<string, string> };

const ONE_MINUTE = 60_000;

// A command run to its end, killed when it takes longer than `timeoutMs`, when it prints more than
// `maxOutput` bytes, or when `signal` says the job is gone, already or while it runs, which
// rejects with JobGone.
export function run(command: string, args: string[], timeoutMs: number, signal?: AbortSignal, maxOutput = Infinity): Promise<string> {
  if (signal?.aborted) return Promise.reject(new JobGone());
  return new Promise((resolve, reject) => {
    const child = spawn("nice", ["-n", "10", command, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let printed = 0;
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} took longer than ${timeoutMs / 1000} s`));
    }, timeoutMs);
    const gone = () => {
      child.kill("SIGKILL");
      reject(new JobGone());
    };
    signal?.addEventListener("abort", gone, { once: true });
    const settle = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", gone);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (printed > maxOutput) return;
      printed += chunk.length;
      if (printed <= maxOutput) return void out.push(chunk);
      out.length = 0;
      settle();
      child.kill("SIGKILL");
      reject(new Error(`${command} printed more than ${maxOutput} bytes`));
    });
    child.stderr.on("data", (chunk: Buffer) => (err = (err + chunk).slice(-4000)));
    child.on("error", (error) => {
      settle();
      reject(error);
    });
    child.on("close", (code) => {
      settle();
      if (code === 0) resolve(Buffer.concat(out).toString());
      else reject(new Error(`${command} exited with ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

const ffmpeg = (args: string[], timeoutMs: number, signal?: AbortSignal) => run("ffmpeg", ["-v", "error", "-nostdin", "-threads", "2", ...args], timeoutMs, signal);

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  level?: number;
  width?: number;
  height?: number;
  bit_rate?: string;
  duration?: string;
  color_transfer?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  side_data_list?: { side_data_type?: string; rotation?: number }[];
};

// The most of ffprobe's output a probe holds (media part review): the fields it asks for
// (ffmpeg-args.ts, probeArgs) take a few kilobytes, so a clip whose output passes this is one no
// phone made, and is unsupported.
export const PROBE_MAX_BYTES = 1024 * 1024;

// Only the tags named in DETAIL_TAGS are asked for, and kept from the format's, so a location tag
// never reaches the parse.
function detailTags(tags: Record<string, unknown> | undefined): Record<string, string> {
  return Object.fromEntries(DETAIL_TAGS.flatMap((key) => (typeof tags?.[key] === "string" ? [[key, tags[key]]] : [])));
}

// The clip's video stream, as the copy decision and the player need it. A clip with none, or one
// ffprobe cannot read, is unsupported.
export async function probe(path: string, signal?: AbortSignal): Promise<Streams> {
  let parsed: { streams?: ProbeStream[]; format?: { duration?: string; bit_rate?: string; tags?: Record<string, unknown> } };
  try {
    parsed = JSON.parse(await run("ffprobe", probeArgs(path), ONE_MINUTE, signal, PROBE_MAX_BYTES));
  } catch (error) {
    if (error instanceof JobGone) throw error;
    throw new Final("unsupported");
  }
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  if (!video?.codec_name || !video.width || !video.height) throw new Final("unsupported");
  const durationMs = Math.round(Number(video.duration ?? parsed.format?.duration ?? 0) * 1000);
  if (!(durationMs > 0)) throw new Final("unsupported");
  return {
    codec: video.codec_name,
    codecString: codecStringOf(video),
    width: video.width,
    height: video.height,
    rotation: Math.abs(video.side_data_list?.find((data) => data.rotation !== undefined)?.rotation ?? 0) % 360,
    bitRate: Number(video.bit_rate ?? parsed.format?.bit_rate ?? 0),
    durationMs,
    hasAudio: parsed.streams?.some((stream) => stream.codec_type === "audio") ?? false,
    hdr: hdrKind(video.color_transfer),
    fps: frameRate(video.avg_frame_rate) ?? frameRate(video.r_frame_rate),
    dolbyVision: video.side_data_list?.some((data) => data.side_data_type === "DOVI configuration record") ?? false,
    tags: detailTags(parsed.format?.tags),
  };
}

// The HDR kind a copy or still is tone-mapped from: the clip's, when the server's ffmpeg has the
// filters (ffmpeg.ts, toneMappingAvailable); nothing otherwise, and the copy is made as in 0.7.
function toneMapped(streams: Streams): "hlg" | "pq" | undefined {
  const status = ffmpegStatus();
  return status.available && status.toneMapping ? streams.hdr : undefined;
}

// What the item records of the clip (details.ts), keys it has no value for left out.
function detailsOf(streams: Streams): ItemDetails {
  return { ...(streams.hdr ? { hdr: streams.hdr } : {}), ...(streams.fps !== undefined ? { fps: streams.fps } : {}) };
}

// The RFC 6381 string the player hands to canPlayType: exact for H.264 (profile and level), a
// common HEVC profile otherwise, and the bare codec name for the rest, which a browser refuses.
function codecStringOf(stream: ProbeStream): string {
  if (stream.codec_name === "h264") {
    const profile = ({ Baseline: "42", "Constrained Baseline": "42", Main: "4D", High: "64", "High 10": "6E" } as Record<string, string>)[stream.profile ?? ""] ?? "64";
    const level = Number(stream.level) || 31;
    return `avc1.${profile}${profile === "42" ? "E0" : "00"}${level.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  if (stream.codec_name === "hevc") return "hvc1.1.6.L93.B0";
  return stream.codec_name ?? "unknown";
}

// Original quality (ffmpeg-args.ts, rewrapArgs): the streams copied, the sound re-encoded only
// when MP4 cannot hold it as it is.
async function rewrap(input: string, output: string, streams: Streams, signal: AbortSignal): Promise<void> {
  try {
    await ffmpeg(rewrapArgs(input, output, streams, "copy"), 10 * ONE_MINUTE, signal);
  } catch (error) {
    if (!streams.hasAudio || error instanceof JobGone) throw error;
    await ffmpeg(rewrapArgs(input, output, streams, "aac"), 10 * ONE_MINUTE, signal);
  }
}

// A copy at a size (ffmpeg-args.ts, copyArgs), tone-mapped from `hdr` when given. Given time by
// the clip's length (copyTimeoutMs), so a long 4K encode is not cut off.
async function makeCopy(input: string, output: string, size: VideoQuality, durationMs: number, hdr: "hlg" | "pq" | undefined, signal: AbortSignal): Promise<void> {
  await ffmpeg(copyArgs(input, output, size, hdr), copyTimeoutMs(durationMs, size), signal);
}

// A frame a second in, or the first of a shorter clip, upright, tone-mapped from `hdr` when given.
async function posterFrame(input: string, durationMs: number, dir: string, hdr: "hlg" | "pq" | undefined, signal: AbortSignal): Promise<Buffer> {
  const frame = join(dir, "frame.png");
  await ffmpeg(posterArgs(input, durationMs > 1500 ? 1 : 0, frame, hdr), ONE_MINUTE, signal);
  return readFile(frame);
}

// The poster for the player and the square thumbnail, exactly as a photo's two files are made.
async function stills(frame: Buffer): Promise<{ poster: Buffer; thumb: Buffer }> {
  const decode = () => sharp(frame, { limitInputPixels: MAX_PIXELS }).flatten({ background: "#ffffff" }).toColourspace("srgb");
  const poster = await decode().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await decode().resize(480, 480, { fit: "cover", position: "attention" }).webp({ quality: 74 }).toBuffer();
  return { poster, thumb };
}

async function putFile(key: string, path: string): Promise<void> {
  const { size } = await stat(path);
  await getStorage().putStream(key, Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>, size);
}

// Whether an item is still there, for a job found gone: files stored for a deleted item go, while
// one whose job another processor took keeps them for that processor.
async function itemExists(id: string): Promise<boolean> {
  const [row] = await getDb().select({ id: photo.id }).from(photo).where(eq(photo.id, id));
  return row !== undefined;
}

// The lease renewed while a job runs (jobs.ts, keepLease): `lost` aborts once a renewal finds the
// job gone, which stops the ffprobe or ffmpeg under way.
function leaseKept(job: ClaimedJob): { lost: AbortController; stop: () => void } {
  const lost = new AbortController();
  const stop = keepLease(() => renewLease(job, job.leasedBy), () => lost.abort());
  return { lost, stop };
}

function goneIf(lost: AbortController): void {
  if (lost.signal.aborted) throw new JobGone();
}

// One job, start to finish. A failure no retry would mend (a clip ffmpeg cannot read, or one over
// the length cap once probed, Review Focus 2) fails the item at once and drops the clip as sent;
// any other error is thrown for the queue to retry under a new lease. A job found gone is left
// alone, its item's files removed if the item went.
export async function processVideo(job: ClaimedJob): Promise<void> {
  const id = job.photoId;
  const [item] = await getDb()
    .select({
      eventId: photo.eventId,
      bytes: photo.bytes,
      sizes: event.albumCopySizes,
      maxMb: event.albumMaxVideoMb,
      maxMinutes: event.albumMaxVideoMinutes,
      albumKeepTakenAt: event.albumKeepTakenAt,
      albumKeepCamera: event.albumKeepCamera,
    })
    .from(photo)
    .innerJoin(event, eq(event.id, photo.eventId))
    .where(eq(photo.id, id));
  if (!item) return;
  const dir = await scratchDir(id);
  const { lost, stop } = leaseKept(job);
  try {
    const sent = join(dir, "sent");
    const stream = await getStorage().stream(sentKey(id));
    if (!stream) throw new Final("the clip as sent is gone");
    await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(sent));
    const sentSize = item.bytes ?? (await stat(sent)).size;
    const streams = await probe(sent, lost.signal);
    const limits = await videoLimits();
    // Only the length cap is checked here: a clip already accepted is processed whatever the
    // event or the operator's Videos switch now says (M8 ticket 01).
    const caps = effectiveVideoCaps({ albumVideosAllowed: true, albumMaxVideoMb: item.maxMb, albumMaxVideoMinutes: item.maxMinutes }, { ...limits, videosAvailable: true, videosOn: true });
    if (streams.durationMs > caps.maxMs) throw new Final("tooLong");

    const original = join(dir, "video.mp4");
    await rewrap(sent, original, streams, lost.signal);
    // A video is ready as soon as it plays everywhere (M8 spec): only the copy an original that is
    // not H.264 needs is made now, from the clip as sent and stored before the original; the rest
    // of the sizes are the `sizes` job's. With the switch off, no copy and no job, as in 0.7. The
    // operator's 4K copy (ticket 04) is among the rest, never made before the item is ready: on a
    // small server it takes far longer than the copy the item needs to play. The sizes are decided
    // from the bit rate the row gives back (video.ts, asProcessed), so Make missing sizes later
    // counts as missing only what the `sizes` job has not made yet.
    const on = await videoProcessing();
    const clip = asProcessed(streams, sentSize);
    const all = on ? sizesToMake(clip, withFourK(clip, item.sizes, await videoFourKCopy())) : [];
    const before = on ? madeBeforeReady(clip, sizesToMake(clip, item.sizes)) : [];
    const hdr = toneMapped(streams);
    for (const size of before) {
      const copy = join(dir, `copy-${size}.mp4`);
      await makeCopy(sent, copy, size, streams.durationMs, hdr, lost.signal);
      await putFile(videoKey(id, copyName(size)), copy);
    }
    await putFile(videoKey(id, "original"), original);
    const { poster, thumb } = await stills(await posterFrame(original, streams.durationMs, dir, hdr, lost.signal));
    await getStorage().put(videoKey(id, "poster"), poster);
    await getStorage().put(videoKey(id, "thumb"), thumb);

    const upright = streams.rotation % 180 === 90 ? { width: streams.height, height: streams.width } : { width: streams.width, height: streams.height };
    goneIf(lost);
    const more = all.some((size) => !before.includes(size));
    // The details the host keeps (M8 ticket 07), from the clip's tags, beside its HDR kind and frame
    // rate; the event's switches are read as the job began.
    const { takenAt, camera } = videoDetails(streams.tags, keepDetailsOf(item), new Date());
    const details = { ...detailsOf(streams), ...(camera ? { camera } : {}) };
    const done = await completeJob(id, { ...upright, durationMs: streams.durationMs, codec: streams.codecString, copies: before, details, takenAt }, more);
    if (!done) {
      // Deleted while it was processed (plan ruling 20): nothing of it stays.
      await removeItemFiles([id]);
      return;
    }
    await getStorage().delete(sentKey(id));
    if (done.status === "pending") await notifyHostsOfVideo(id);
  } catch (error) {
    if (error instanceof JobGone) {
      console.log(`Videos: the job of item ${id} was gone at its lease's renewal, so its processing stopped.`);
      if (!(await itemExists(id))) await removeItemFiles([id]);
      return;
    }
    if (error instanceof Final) {
      await failJob(job, error.message, true);
      await getStorage().delete(sentKey(id));
      return;
    }
    throw error;
  } finally {
    stop();
    await removeDir(dir);
  }
}

// The sizes added to a ready item's copies, each once and kept largest first, for an item still
// approved or pending; false when none answered, as for one deleted while its copy was made. The
// details the stored original was probed for are merged into the item's (M8 ticket 05), so a
// video from before 0.8 gains its HDR kind and frame rate when Make missing sizes reaches it.
export async function addCopies(photoId: string, sizes: VideoQuality[], details: ItemDetails = {}): Promise<boolean> {
  const added = sql`array[${sql.join(sizes.map((size) => sql`${size}::video_size`), sql`, `)}]::video_size[]`;
  const updated = await getDb()
    .update(photo)
    .set({ copies: sql`array(select distinct size from unnest(${photo.copies} || ${added}) as size order by size)`, details: sql`${photo.details} || ${JSON.stringify(details)}::jsonb` })
    .where(and(eq(photo.id, photoId), inArray(photo.status, ["approved", "pending"])))
    .returning({ id: photo.id });
  return updated.length > 0;
}

// One claim of a `sizes` job (M8 ticket 03): the smallest size the item lacks of those its event
// asks for now, so the size a slow connection needs never waits behind a longer encode, made from
// the stored original, since the clip as sent went when the item became ready (plan ruling 8).
// The job is given back while more sizes are missing, and dropped once none is, or when the item
// is no longer a ready video or the site's switch is off. The operator's 4K copy counts among the
// sizes when its switch is on (ticket 04). A copy is not started while the disk would be left under
// the free-space floor uploads keep (video.ts, roomForCopy): the job is dropped with one line in
// the log, never retried, so a full disk cannot spin the queue, and the operator presses Make
// missing sizes again once there is room (media part review). Anything thrown is the queue's: it
// drops the job, and the item stays ready. A job found gone, or whose item was deleted before its
// original was read, is left alone, its copy removed if the item went.
export async function processSizes(job: ClaimedJob): Promise<void> {
  const id = job.photoId;
  const [item] = await getDb()
    .select({ kind: photo.kind, status: photo.status, codec: photo.codec, width: photo.width, height: photo.height, bytes: photo.bytes, durationMs: photo.durationMs, copies: photo.copies, sizes: event.albumCopySizes })
    .from(photo)
    .innerJoin(event, eq(event.id, photo.eventId))
    .where(eq(photo.id, id));
  if (!item || item.kind !== "video" || (item.status !== "approved" && item.status !== "pending") || !(await videoProcessing())) return dropJob(job);
  const original = probeOfItem(item);
  const missing = original ? missingSizes(item, withFourK(original, item.sizes, await videoFourKCopy())) : [];
  if (missing.length === 0) return dropJob(job);
  const size = missing[missing.length - 1];
  if (!roomForCopy(await freeDiskBytes(), size, item.durationMs ?? 0)) {
    console.error(`Videos: the disk is too full to make the ${size} copy of item ${id}, so its sizes job was dropped; press Make missing sizes once there is room.`);
    return dropJob(job);
  }
  const key = videoKey(id, copyName(size));
  const dir = await scratchDir(id);
  const { lost, stop } = leaseKept(job);
  try {
    const stored = join(dir, "video.mp4");
    const stream = await getStorage().stream(videoKey(id, "original"));
    if (!stream) {
      // Deleted since it was claimed: its job went with it, so nothing is logged.
      if (!(await itemExists(id))) return;
      throw new Error("the original is gone");
    }
    await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(stored));
    // The stored original is probed for its HDR kind, which the copy is tone-mapped from, and
    // its details, which an item from before 0.8 lacks.
    const streams = await probe(stored, lost.signal);
    const copy = join(dir, `copy-${size}.mp4`);
    await makeCopy(stored, copy, size, item.durationMs ?? 0, toneMapped(streams), lost.signal);
    await putFile(key, copy);
    goneIf(lost);
    // Deleted while its copy was made: the copy goes too.
    if (!(await addCopies(id, [size], detailsOf(streams)))) await getStorage().delete(key);
    await (missing.length > 1 ? releaseJob(job) : dropJob(job));
  } catch (error) {
    if (!(error instanceof JobGone)) throw error;
    console.log(`Videos: the sizes job of item ${id} was gone at its lease's renewal, so its ${size} copy stopped.`);
    if (!(await itemExists(id))) await getStorage().delete(key);
  } finally {
    stop();
    await removeDir(dir);
  }
}

// A live photo's motion given up (M8 ticket 08): its job goes, and the clip as sent with it, so the
// photo stays a still; a motion a failed try had already stored goes too, unless the photo is live
// (a try that threw after completeMotion). The photo itself is never touched.
export async function giveUpMotion(job: ClaimedJob): Promise<void> {
  await dropJob(job);
  await getStorage().delete(motionSentKey(job.photoId));
  const [item] = await getDb().select({ live: photo.live }).from(photo).where(eq(photo.id, job.photoId));
  if (!item?.live) await getStorage().delete(motionKey(job.photoId));
}

// One claim of a `motion` job (M8 ticket 08): the clip the photo carried, stored as sent while the
// photo was finished, made into a few silent seconds of H.264 at most 720 on its short side
// (ffmpeg-args.ts, motionArgs), tone-mapped as a copy is when it is HDR, and stored beside the
// photo's files; then the photo is live and the job and the clip as sent go. A clip ffmpeg cannot
// read is given up at once, with one line in the log; anything else thrown is the queue's, which
// tries again and gives up on the last try. A job found gone is left alone, and the motion removed
// if the photo went.
export async function processMotion(job: ClaimedJob): Promise<void> {
  const id = job.photoId;
  // Deleted since it was claimed: its job went with it, and its files with its row.
  if (!(await itemExists(id))) return;
  const dir = await scratchDir(id);
  const { lost, stop } = leaseKept(job);
  try {
    const sent = join(dir, "motion-sent");
    const stream = await getStorage().stream(motionSentKey(id));
    if (!stream) throw new Final("the clip as sent is gone");
    await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(sent));
    const streams = await probe(sent, lost.signal);
    const motion = join(dir, "motion.mp4");
    await ffmpeg(motionArgs(sent, motion, toneMapped(streams)), 3 * ONE_MINUTE, lost.signal);
    await putFile(motionKey(id), motion);
    goneIf(lost);
    if (!(await completeMotion(id))) {
      // Deleted while its motion was made (plan ruling 20): nothing of it stays.
      await removeItemFiles([id]);
      return;
    }
    await getStorage().delete(motionSentKey(id));
  } catch (error) {
    if (error instanceof JobGone) {
      console.log(`Videos: the motion job of live photo ${id} was gone at its lease's renewal, so its motion stopped.`);
      if (!(await itemExists(id))) await removeItemFiles([id]);
      return;
    }
    if (error instanceof Final) {
      console.error(`Videos: the motion of photo ${id} could not be made (${error.message}), so it stays a still.`);
      await giveUpMotion(job);
      return;
    }
    throw error;
  } finally {
    stop();
    await removeDir(dir);
  }
}
