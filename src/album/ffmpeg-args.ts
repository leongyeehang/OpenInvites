import { DETAIL_TAGS } from "./details";
import { MOTION_MAX_SECONDS } from "./motion";
import { TARGET_BITRATE, TARGET_SHORT_SIDE, type VideoQuality } from "./video";

// What ffmpeg is asked to do with a clip (processing.ts runs it), kept apart so the lists can be
// tested as they are. A video in standard colour gets exactly 0.7's arguments. An HDR one (HLG or
// PQ, details.ts) keeps its HDR in the original, a stream copy, while its copies, poster and
// thumbnail are tone-mapped to BT.709 (M8 ticket 05), so they look natural on any screen rather
// than flat and grey; processing passes no HDR kind when the server's ffmpeg lacks the filters.

// What ffprobe is asked of a clip (processing.ts, probe; media part review): the video stream's
// fields the copy decision, the player and the item's details read, the side data that holds a
// phone's rotation and a Dolby Vision record, the format's length and bit rate, and only the format
// tags named in DETAIL_TAGS. Nothing else is printed, so a location tag never leaves ffprobe, and a
// file's other metadata, however large, is never handed to the processor.
const PROBE_STREAM = ["codec_type", "codec_name", "profile", "level", "width", "height", "bit_rate", "duration", "color_transfer", "avg_frame_rate", "r_frame_rate"];

export function probeArgs(input: string): string[] {
  const entries = [`stream=${PROBE_STREAM.join(",")}`, "stream_side_data=side_data_type,rotation", "format=duration,bit_rate", `format_tags=${DETAIL_TAGS.join(",")}`];
  return ["-v", "error", "-print_format", "json", "-show_entries", entries.join(":"), input];
}

// To linear light, then BT.709's primaries, then the hable curve that brings HDR's highlights
// within standard range, then BT.709's transfer: limited-range 4:2:0 for a copy, full-range RGB
// for a still. zscale and tonemap run on the CPU (ADR-0007); npl=100 and hable are the common
// recipe, chosen over libplacebo, which wants a GPU, and colorspace, which does not tone-map.
export function toneMapFilter(hdr: "hlg" | "pq", out: "video" | "still"): string {
  const transfer = hdr === "hlg" ? "arib-std-b67" : "smpte2084";
  // A phone's HLG and PQ are bt2020nc, bt2020 and tv range, which the input is taken to be.
  const linear = `zscale=tin=${transfer}:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0`;
  return out === "video" ? `${linear},zscale=t=bt709:m=bt709:r=tv,format=yuv420p` : `${linear},zscale=t=bt709:r=pc,format=gbrp`;
}

// Original quality: the streams copied into MP4, metadata and chapters dropped, the index in
// front. HEVC is tagged hvc1 or Safari will not play it; audio MP4 cannot hold is re-encoded
// (`audio: "aac"`). A clip with a Dolby Vision record is muxed under `-strict unofficial`, which
// some ffmpeg versions need before they write the record's box; whether an iPhone's survives has
// not been checked yet (M8 ticket 05).
export function rewrapArgs(input: string, output: string, streams: { codec: string; hasAudio: boolean; dolbyVision: boolean }, audio: "copy" | "aac"): string[] {
  const maps = ["-map", "0:v:0", ...(streams.hasAudio ? ["-map", "0:a:0"] : [])];
  const strip = ["-map_metadata", "-1", "-map_metadata:s:v", "-1", ...(streams.hasAudio ? ["-map_metadata:s:a", "-1"] : []), "-map_chapters", "-1"];
  const tag = streams.codec === "hevc" ? ["-tag:v", "hvc1"] : [];
  const dolbyVision = streams.dolbyVision ? ["-strict", "unofficial"] : [];
  const codecs = audio === "copy" ? ["-c", "copy"] : ["-c:v", "copy"];
  const sound = audio === "aac" ? ["-c:a", "aac", "-b:a", "128k"] : [];
  return ["-y", "-i", input, ...maps, ...codecs, ...tag, ...dolbyVision, ...sound, ...strip, "-movflags", "+faststart", "-f", "mp4", output];
}

// A copy: H.264 at a size, never larger than the original on either side, about the size's bit
// rate, AAC audio, upright (ffmpeg rotates what the phone's matrix says). An HDR original is
// scaled first, at its own bit depth, then tone-mapped, and the copy is tagged BT.709 throughout.
export function copyArgs(input: string, output: string, size: VideoQuality, hdr: "hlg" | "pq" | undefined): string[] {
  const rate = TARGET_BITRATE[size];
  const { filter, tags } = scaled(TARGET_SHORT_SIDE[size], hdr);
  return ["-y", "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", String(rate), "-bufsize", String(rate * 2), "-vf", filter, "-pix_fmt", "yuv420p", ...tags, "-c:a", "aac", "-b:a", "128k", "-map_metadata", "-1", "-movflags", "+faststart", output];
}

// A live photo's motion (M8 ticket 08): its first MOTION_MAX_SECONDS, the video alone, as H.264 at a
// short side of at most 720 and never larger than the clip's, metadata and chapters dropped, the
// index in front; an HDR clip tone-mapped as a copy is.
export function motionArgs(input: string, output: string, hdr: "hlg" | "pq" | undefined): string[] {
  const { filter, tags } = scaled(TARGET_SHORT_SIDE["720p"], hdr);
  return ["-y", "-i", input, "-t", String(MOTION_MAX_SECONDS), "-map", "0:v:0", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-vf", filter, "-pix_fmt", "yuv420p", ...tags, "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", output];
}

// The filter that brings a clip to a short side of at most `side`, never up, upright, then
// tone-maps an HDR one, with the BT.709 tags such a result carries.
function scaled(side: number, hdr: "hlg" | "pq" | undefined): { filter: string; tags: string[] } {
  const scale = `scale=w='if(lt(iw,ih),min(${side},iw),-2)':h='if(lt(iw,ih),-2,min(${side},ih))'`;
  return {
    filter: hdr ? `${scale},${toneMapFilter(hdr, "video")}` : scale,
    tags: hdr ? ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"] : [],
  };
}

// One frame at `atSeconds`, upright, as PNG for the poster and thumbnail (processing.ts, stills);
// an HDR one tone-mapped as its copies are.
export function posterArgs(input: string, atSeconds: number, output: string, hdr: "hlg" | "pq" | undefined): string[] {
  return ["-y", "-ss", String(atSeconds), "-i", input, "-frames:v", "1", ...(hdr ? ["-vf", toneMapFilter(hdr, "still")] : []), "-f", "image2", output];
}
