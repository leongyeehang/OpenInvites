import { spawnSync } from "node:child_process";

// Whether this server can process videos (M7 ticket 05, ADR-0007): ffmpeg and ffprobe on the
// path, 6 or later, since a phone's rotation survives a stream copy only from 6. Checked once at
// start (instrumentation.ts) and kept for the pages and routes that ask; never a reason to fail
// the start: without it the site refuses videos and Site settings says why.

export const FFMPEG_MIN_MAJOR = 6;

export type FfmpegStatus = { available: true; version: string } | { available: false; reason: "missing" | "old"; version?: string };

// The version on ffmpeg's first line, "ffmpeg version 6.1.1 Copyright …" (some builds say "n7.0.2").
export function parseFfmpegVersion(output: string): string | undefined {
  return /^ffmpeg version (\S+)/m.exec(output)?.[1];
}

export function ffmpegUsable(version: string | undefined): boolean {
  const major = /^n?(\d+)/.exec(version ?? "")?.[1];
  return major !== undefined && Number(major) >= FFMPEG_MIN_MAJOR;
}

function versionOutput(command: string): string | undefined {
  const result = spawnSync(command, ["-version"], { encoding: "utf8", timeout: 5000 });
  return result.error || result.status !== 0 ? undefined : result.stdout;
}

export function detectFfmpeg(): FfmpegStatus {
  const ffmpeg = versionOutput("ffmpeg");
  const ffprobe = versionOutput("ffprobe");
  if (!ffmpeg || !ffprobe) return { available: false, reason: "missing" };
  const version = parseFfmpegVersion(ffmpeg);
  if (!version || !ffmpegUsable(version)) return { available: false, reason: "old", version };
  return { available: true, version };
}

// Kept on globalThis, as the mail worker keeps its state: the instrumentation hook and the pages
// are bundled apart but run in one process.
const STATE = Symbol.for("openinvites.ffmpeg");

export function checkFfmpegAtStart(): void {
  const status = detectFfmpeg();
  (globalThis as unknown as Record<symbol, FfmpegStatus>)[STATE] = status;
  if (status.available) console.log(`Videos: ffmpeg ${status.version} found.`);
  else if (status.reason === "old") console.warn(`Videos: ffmpeg ${status.version} is older than ${FFMPEG_MIN_MAJOR}; videos are refused until it is updated.`);
  else console.warn("Videos: ffmpeg or ffprobe not found; videos are refused.");
}

export function ffmpegStatus(): FfmpegStatus {
  return (globalThis as unknown as Record<symbol, FfmpegStatus | undefined>)[STATE] ?? { available: false, reason: "missing" };
}
