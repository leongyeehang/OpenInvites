import { describe, expect, it } from "vitest";
import { DETAIL_TAGS } from "./details";
import { copyArgs, motionArgs, posterArgs, probeArgs, rewrapArgs, toneMapFilter } from "./ffmpeg-args";

// What ffmpeg is asked to do with a clip (M8 ticket 05): the arguments as they were in 0.7 for a
// video in standard colour, and an HDR one's copies and poster tone-mapped to BT.709.

const SCALE_1080 = "scale=w='if(lt(iw,ih),min(1080,iw),-2)':h='if(lt(iw,ih),-2,min(1080,ih))'";
const SCALE_720 = "scale=w='if(lt(iw,ih),min(720,iw),-2)':h='if(lt(iw,ih),-2,min(720,ih))'";

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];
const holdsRun = (args: string[], run: string[]) => args.some((_, at) => run.every((arg, offset) => args[at + offset] === arg));

describe("toneMapFilter", () => {
  it("takes HLG or PQ to BT.709 through linear light with hable, for a copy", () => {
    expect(toneMapFilter("hlg", "video")).toBe(
      "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p",
    );
    expect(toneMapFilter("pq", "video")).toBe(
      "zscale=tin=smpte2084:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p",
    );
  });

  it("ends in full-range RGB for a still", () => {
    expect(toneMapFilter("hlg", "still")).toMatch(/^zscale=tin=arib-std-b67:.*tonemap=tonemap=hable:desat=0,zscale=t=bt709:r=pc,format=gbrp$/);
  });
});

describe("copyArgs", () => {
  it("is 0.7's copy for a video in standard colour", () => {
    expect(copyArgs("in.mp4", "out.mp4", "1080p", undefined)).toEqual(
      ["-y", "-i", "in.mp4", "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "6000000", "-bufsize", "12000000", "-vf", SCALE_1080, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-map_metadata", "-1", "-movflags", "+faststart", "out.mp4"],
    );
  });

  it("scales an HDR video, then tone-maps it, and tags the copy BT.709", () => {
    const args = copyArgs("in.mp4", "out.mp4", "720p", "hlg");
    expect(after(args, "-vf")).toBe(`${SCALE_720},${toneMapFilter("hlg", "video")}`);
    expect(holdsRun(args, ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"])).toBe(true);
    expect(after(args, "-maxrate")).toBe("3000000");
    expect(args.at(-1)).toBe("out.mp4");
  });
});

describe("rewrapArgs", () => {
  const streams = { codec: "hevc", hasAudio: true, dolbyVision: false };

  it("copies the streams with every piece of metadata dropped and the index in front", () => {
    expect(rewrapArgs("in.mov", "out.mp4", streams, "copy")).toEqual(
      ["-y", "-i", "in.mov", "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", "-tag:v", "hvc1", "-map_metadata", "-1", "-map_metadata:s:v", "-1", "-map_metadata:s:a", "-1", "-map_chapters", "-1", "-movflags", "+faststart", "-f", "mp4", "out.mp4"],
    );
  });

  it("tags HEVC alone hvc1", () => {
    expect(rewrapArgs("in", "out", streams, "copy")).toContain("hvc1");
    expect(rewrapArgs("in", "out", { ...streams, codec: "h264" }, "copy")).not.toContain("-tag:v");
  });

  it("lets ffmpeg write a Dolby Vision record only for a clip that has one", () => {
    expect(holdsRun(rewrapArgs("in", "out", { ...streams, dolbyVision: true }, "copy"), ["-strict", "unofficial"])).toBe(true);
    expect(rewrapArgs("in", "out", streams, "copy")).not.toContain("-strict");
  });

  it("re-encodes the sound to AAC when asked, and drops the audio's mapping for a silent clip", () => {
    const aac = rewrapArgs("in", "out", streams, "aac");
    expect(holdsRun(aac, ["-c:v", "copy"])).toBe(true);
    expect(holdsRun(aac, ["-c:a", "aac", "-b:a", "128k"])).toBe(true);
    const silent = rewrapArgs("in", "out", { ...streams, hasAudio: false }, "copy");
    expect(silent).not.toContain("0:a:0");
    expect(silent).not.toContain("-map_metadata:s:a");
  });
});

describe("posterArgs", () => {
  it("takes one frame, tone-mapped for an HDR video and as it is otherwise", () => {
    expect(posterArgs("in.mp4", 1, "frame.png", undefined)).toEqual(["-y", "-ss", "1", "-i", "in.mp4", "-frames:v", "1", "-f", "image2", "frame.png"]);
    const hdr = posterArgs("in.mp4", 0, "frame.png", "pq");
    expect(after(hdr, "-vf")).toBe(toneMapFilter("pq", "still"));
    expect(after(hdr, "-ss")).toBe("0");
  });
});

// M8 ticket 08: a live photo's motion, three silent seconds of H.264 at a short side of at most 720.
describe("motionArgs", () => {
  const SCALE = "scale=w='if(lt(iw,ih),min(720,iw),-2)':h='if(lt(iw,ih),-2,min(720,ih))'";

  it("cuts the clip to three seconds, silent, at most 720 on its short side, with nothing of its metadata", () => {
    expect(motionArgs("in.mp4", "out.mp4", undefined)).toEqual(
      ["-y", "-i", "in.mp4", "-t", "3", "-map", "0:v:0", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-vf", SCALE, "-pix_fmt", "yuv420p", "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", "out.mp4"],
    );
  });

  it("tone-maps an HDR clip after scaling it, and tags it BT.709", () => {
    const args = motionArgs("in.mp4", "out.mp4", "pq");
    expect(after(args, "-vf")).toBe(`${SCALE},${toneMapFilter("pq", "video")}`);
    expect(holdsRun(args, ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"])).toBe(true);
    expect(args.at(-1)).toBe("out.mp4");
  });
});

// What ffprobe is asked for (media part review): only the stream fields, format fields and tags the
// probe reads, so a file's other metadata, a location tag above all, is never printed, and the
// output stays small whatever the file carries.
describe("probeArgs", () => {
  it("names each field the probe reads, and the detail tags alone", () => {
    expect(probeArgs("in.mp4")).toEqual([
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_entries",
      "stream=codec_type,codec_name,profile,level,width,height,bit_rate,duration,color_transfer,avg_frame_rate,r_frame_rate" +
        ":stream_side_data=side_data_type,rotation" +
        ":format=duration,bit_rate" +
        ":format_tags=com.apple.quicktime.creationdate,creation_time,com.apple.quicktime.make,com.apple.quicktime.model,com.android.manufacturer,com.android.model",
      "in.mp4",
    ]);
    expect(after(probeArgs("in.mp4"), "-show_entries").split(":format_tags=")[1].split(",")).toEqual([...DETAIL_TAGS]);
  });

  it("never asks for a location tag, nor for every stream or format field", () => {
    const args = probeArgs("in.mp4");
    expect(args.join(" ")).not.toMatch(/location|xyz|gps/i);
    expect(args).not.toContain("-show_streams");
    expect(args).not.toContain("-show_format");
  });
});
