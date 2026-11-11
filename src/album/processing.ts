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
import { videoLimits, videoProcessing } from "@/instance/repository";
import { getStorage } from "@/storage/storage";
import { MAX_PIXELS } from "@/uploads/validate";
import { removeItemFiles } from "./files";
import { completeJob, dropJob, failJob, releaseJob, type ClaimedJob } from "./jobs";
import { notifyHostsOfVideo } from "./notify-hosts";
import { removeDir, scratchDir } from "./tmp";
import { copyName, effectiveVideoCaps, madeBeforeReady, missingSizes, sentKey, sizesToMake, TARGET_BITRATE, TARGET_SHORT_SIDE, videoKey, type Probe, type VideoQuality } from "./video";

// What the queue does to a clip (M7 spec, "Videos"; ADR-0007): reads its streams with ffprobe;
// rewraps it at original quality into MP4 with every piece of metadata dropped and the index in
// front, which is instant since the frames are copied; makes the H.264 copy an original that is
// not H.264 needs to play everywhere, when the site's switch is on; takes a poster frame and the
// album's thumbnail through the same image pipeline as photos; stores all of it; and deletes the
// clip as sent. The other sizes the event asks for (video.ts, sizesToMake) follow from the stored
// original, one a claim, once the item is ready (M8 ticket 03, processSizes). ffmpeg runs at low
// priority with two threads, so the site keeps answering pages.

// A failure no retry would mend: the item is failed at once.
class Final extends Error {}

type Streams = Probe & { durationMs: number; hasAudio: boolean; codecString: string };

const ONE_MINUTE = 60_000;

function run(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("nice", ["-n", "10", command, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk));
    child.stderr.on("data", (chunk: Buffer) => (err = (err + chunk).slice(-4000)));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} took longer than ${timeoutMs / 1000} s`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${command} exited with ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

const ffmpeg = (args: string[], timeoutMs: number) => run("ffmpeg", ["-v", "error", "-nostdin", "-threads", "2", ...args], timeoutMs);

type ProbeStream = { codec_type?: string; codec_name?: string; profile?: string; level?: number; width?: number; height?: number; bit_rate?: string; duration?: string; side_data_list?: { rotation?: number }[] };

// The clip's video stream, as the copy decision and the player need it. A clip with none, or one
// ffprobe cannot read, is unsupported.
export async function probe(path: string): Promise<Streams> {
  let parsed: { streams?: ProbeStream[]; format?: { duration?: string; bit_rate?: string } };
  try {
    parsed = JSON.parse(await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], ONE_MINUTE));
  } catch {
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
  };
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

// Original quality: the streams copied into MP4, metadata and chapters dropped, the index in
// front. HEVC is tagged hvc1 or Safari will not play it; audio MP4 cannot hold is re-encoded.
async function rewrap(input: string, output: string, streams: Streams): Promise<void> {
  const maps = ["-map", "0:v:0", ...(streams.hasAudio ? ["-map", "0:a:0"] : [])];
  const strip = ["-map_metadata", "-1", "-map_metadata:s:v", "-1", ...(streams.hasAudio ? ["-map_metadata:s:a", "-1"] : []), "-map_chapters", "-1"];
  const tag = streams.codec === "hevc" ? ["-tag:v", "hvc1"] : [];
  const tail = [...strip, "-movflags", "+faststart", "-f", "mp4", output];
  try {
    await ffmpeg(["-y", "-i", input, ...maps, "-c", "copy", ...tag, ...tail], 10 * ONE_MINUTE);
  } catch (error) {
    if (!streams.hasAudio) throw error;
    await ffmpeg(["-y", "-i", input, ...maps, "-c:v", "copy", ...tag, "-c:a", "aac", "-b:a", "128k", ...tail], 10 * ONE_MINUTE);
  }
}

// A copy: H.264 at a size, never larger than the original on either side, about the size's bit
// rate, AAC audio, upright (ffmpeg rotates what the phone's matrix says).
async function makeCopy(input: string, output: string, size: VideoQuality): Promise<void> {
  const side = TARGET_SHORT_SIDE[size];
  const rate = TARGET_BITRATE[size];
  const scale = `scale=w='if(lt(iw,ih),min(${side},iw),-2)':h='if(lt(iw,ih),-2,min(${side},ih))'`;
  await ffmpeg(
    ["-y", "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", String(rate), "-bufsize", String(rate * 2), "-vf", scale, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-map_metadata", "-1", "-movflags", "+faststart", output],
    60 * ONE_MINUTE,
  );
}

// A frame a second in, or the first of a shorter clip, upright.
async function posterFrame(input: string, durationMs: number, dir: string): Promise<Buffer> {
  const at = durationMs > 1500 ? 1 : 0;
  const frame = join(dir, "frame.png");
  await ffmpeg(["-y", "-ss", String(at), "-i", input, "-frames:v", "1", "-f", "image2", frame], ONE_MINUTE);
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

// One job, start to finish. A failure no retry would mend (a clip ffmpeg cannot read, or one over
// the length cap once probed, Review Focus 2) fails the item at once and drops the clip as sent;
// any other error is thrown for the queue to retry under a new lease.
export async function processVideo(job: ClaimedJob): Promise<void> {
  const id = job.photoId;
  const [item] = await getDb()
    .select({ eventId: photo.eventId, sizes: event.albumCopySizes, maxMb: event.albumMaxVideoMb, maxMinutes: event.albumMaxVideoMinutes })
    .from(photo)
    .innerJoin(event, eq(event.id, photo.eventId))
    .where(eq(photo.id, id));
  if (!item) return;
  const dir = await scratchDir(id);
  try {
    const sent = join(dir, "sent");
    const stream = await getStorage().stream(sentKey(id));
    if (!stream) throw new Final("the clip as sent is gone");
    await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(sent));
    const streams = await probe(sent);
    const limits = await videoLimits();
    // Only the length cap is checked here: a clip already accepted is processed whatever the
    // event or the operator's Videos switch now says (M8 ticket 01).
    const caps = effectiveVideoCaps({ albumVideosAllowed: true, albumMaxVideoMb: item.maxMb, albumMaxVideoMinutes: item.maxMinutes }, { ...limits, videosAvailable: true, videosOn: true });
    if (streams.durationMs > caps.maxMs) throw new Final("tooLong");

    const original = join(dir, "video.mp4");
    await rewrap(sent, original, streams);
    // A video is ready as soon as it plays everywhere (M8 spec): only the copy an original that is
    // not H.264 needs is made now, from the clip as sent and stored before the original; the rest
    // of the sizes are the `sizes` job's. With the switch off, no copy and no job, as in 0.7.
    const on = await videoProcessing();
    const sizes = on ? sizesToMake(streams, item.sizes) : [];
    const before = on ? madeBeforeReady(streams, sizes) : [];
    for (const size of before) {
      const copy = join(dir, `copy-${size}.mp4`);
      await makeCopy(sent, copy, size);
      await putFile(videoKey(id, copyName(size)), copy);
    }
    await putFile(videoKey(id, "original"), original);
    const { poster, thumb } = await stills(await posterFrame(original, streams.durationMs, dir));
    await getStorage().put(videoKey(id, "poster"), poster);
    await getStorage().put(videoKey(id, "thumb"), thumb);

    const upright = streams.rotation % 180 === 90 ? { width: streams.height, height: streams.width } : { width: streams.width, height: streams.height };
    const done = await completeJob(id, { ...upright, durationMs: streams.durationMs, codec: streams.codecString, copies: before }, sizes.length > before.length);
    if (!done) {
      // Deleted while it was processed (plan ruling 20): nothing of it stays.
      await removeItemFiles([id]);
      return;
    }
    await getStorage().delete(sentKey(id));
    if (done.status === "pending") await notifyHostsOfVideo(id);
  } catch (error) {
    if (error instanceof Final) {
      await failJob(job, error.message, true);
      await getStorage().delete(sentKey(id));
      return;
    }
    throw error;
  } finally {
    await removeDir(dir);
  }
}

// The sizes added to a ready item's copies, each once and kept largest first, for an item still
// approved or pending; false when none answered, as for one deleted while its copy was made.
export async function addCopies(photoId: string, sizes: VideoQuality[]): Promise<boolean> {
  const added = sql`array[${sql.join(sizes.map((size) => sql`${size}::video_size`), sql`, `)}]::video_size[]`;
  const updated = await getDb()
    .update(photo)
    .set({ copies: sql`array(select distinct size from unnest(${photo.copies} || ${added}) as size order by size)` })
    .where(and(eq(photo.id, photoId), inArray(photo.status, ["approved", "pending"])))
    .returning({ id: photo.id });
  return updated.length > 0;
}

// One claim of a `sizes` job (M8 ticket 03): the smallest size the item lacks of those its event
// asks for now, so the size a slow connection needs never waits behind a longer encode, made from
// the stored original, since the clip as sent went when the item became ready (plan ruling 8).
// The job is given back while more sizes are missing, and dropped once none is, or when the item
// is no longer a ready video or the site's switch is off. Anything thrown is the queue's: it drops
// the job, and the item stays ready.
export async function processSizes(job: ClaimedJob): Promise<void> {
  const id = job.photoId;
  const [item] = await getDb()
    .select({ kind: photo.kind, status: photo.status, codec: photo.codec, width: photo.width, height: photo.height, bytes: photo.bytes, durationMs: photo.durationMs, copies: photo.copies, sizes: event.albumCopySizes })
    .from(photo)
    .innerJoin(event, eq(event.id, photo.eventId))
    .where(eq(photo.id, id));
  if (!item || item.kind !== "video" || (item.status !== "approved" && item.status !== "pending") || !(await videoProcessing())) return dropJob(job);
  const missing = missingSizes(item, item.sizes);
  if (missing.length === 0) return dropJob(job);
  const size = missing[missing.length - 1];
  const dir = await scratchDir(id);
  try {
    const original = join(dir, "video.mp4");
    const stream = await getStorage().stream(videoKey(id, "original"));
    if (!stream) throw new Error("the original is gone");
    await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(original));
    const copy = join(dir, `copy-${size}.mp4`);
    await makeCopy(original, copy, size);
    const key = videoKey(id, copyName(size));
    await putFile(key, copy);
    // Deleted while its copy was made: the copy goes too.
    if (!(await addCopies(id, [size]))) await getStorage().delete(key);
    await (missing.length > 1 ? releaseJob(job) : dropJob(job));
  } finally {
    await removeDir(dir);
  }
}
