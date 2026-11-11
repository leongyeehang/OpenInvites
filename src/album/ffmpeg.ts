import { spawnSync } from "node:child_process";

// Whether this server can process videos (M7 ticket 05, ADR-0007): ffmpeg and ffprobe on the
// path, 6 or later, since a phone's rotation survives a stream copy only from 6. Checked once at
// start (instrumentation.ts) and kept for the pages and routes that ask; never a reason to fail
// the start: without it the site refuses videos and Site settings says why. It also learns whether
// that ffmpeg can convert an HDR video's copies to standard colour (M8 ticket 05): without the
// zscale and tonemap filters, copies are made as in 0.7 and the Storage card says so.

export const FFMPEG_MIN_MAJOR = 6;

export type FfmpegStatus = { available: true; version: string; toneMapping: boolean } | { available: false; reason: "missing" | "old"; version?: string };

// The version on ffmpeg's first line, "ffmpeg version 6.1.1 Copyright …" (some builds say "n7.0.2").
export function parseFfmpegVersion(output: string): string | undefined {
  return /^ffmpeg version (\S+)/m.exec(output)?.[1];
}

export function ffmpegUsable(version: string | undefined): boolean {
  const major = /^n?(\d+)/.exec(version ?? "")?.[1];
  return major !== undefined && Number(major) >= FFMPEG_MIN_MAJOR;
}

// The filters in `ffmpeg -hide_banner -filters`: each line after the legend is its flags (three
// columns up to ffmpeg 7, two from 8), the name, and what it takes and gives ("V->V"), which no
// legend line has.
export function parseFilters(output: string): Set<string> {
  return new Set([...output.matchAll(/^ *[A-Z.|]{2,3} +(\S+) +\S*->\S* /gm)].map((match) => match[1]));
}

// What HDR copies are converted with (ffmpeg-args.ts, toneMapFilter): both run on the CPU.
export function toneMappingAvailable(filters: Set<string>): boolean {
  return filters.has("zscale") && filters.has("tonemap");
}

function output(command: string, args: string[]): string | undefined {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5000 });
  return result.error || result.status !== 0 ? undefined : result.stdout;
}

const versionOutput = (command: string) => output(command, ["-version"]);

export function detectFfmpeg(): FfmpegStatus {
  const ffmpeg = versionOutput("ffmpeg");
  const ffprobe = versionOutput("ffprobe");
  if (!ffmpeg || !ffprobe) return { available: false, reason: "missing" };
  const version = parseFfmpegVersion(ffmpeg);
  if (!version || !ffmpegUsable(version)) return { available: false, reason: "old", version };
  return { available: true, version, toneMapping: toneMappingAvailable(parseFilters(output("ffmpeg", ["-hide_banner", "-filters"]) ?? "")) };
}

// Kept on globalThis, as the mail worker keeps its state: the instrumentation hook and the pages
// are bundled apart but run in one process.
const STATE = Symbol.for("openinvites.ffmpeg");

export function checkFfmpegAtStart(): void {
  const status = detectFfmpeg();
  (globalThis as unknown as Record<symbol, FfmpegStatus>)[STATE] = status;
  if (status.available) {
    console.log(`Videos: ffmpeg ${status.version} found.`);
    console.log(status.toneMapping ? "Videos: HDR videos' copies are converted to standard colour." : "Videos: this ffmpeg lacks the zscale and tonemap filters, so HDR videos' copies are not converted and look flatter.");
  }
  else if (status.reason === "old") console.warn(`Videos: ffmpeg ${status.version} is older than ${FFMPEG_MIN_MAJOR}; videos are refused until it is updated.`);
  else console.warn("Videos: ffmpeg or ffprobe not found; videos are refused.");
}

export function ffmpegStatus(): FfmpegStatus {
  return (globalThis as unknown as Record<symbol, FfmpegStatus | undefined>)[STATE] ?? { available: false, reason: "missing" };
}
