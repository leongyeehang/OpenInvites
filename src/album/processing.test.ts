import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { probe, PROBE_MAX_BYTES } from "./processing";

// ffprobe's output is bounded (media part review): a file whose metadata would print more than
// PROBE_MAX_BYTES is not held whole by the processor; its ffprobe is killed and the clip is
// unsupported. The child process is a stand-in that prints what each test gives it.

type Child = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> };
const children = vi.hoisted(() => ({ made: [] as unknown[], print: [] as string[] }));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const spawn = vi.fn(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() }) as Child;
    child.kill = vi.fn(() => queueMicrotask(() => child.emit("close", null)));
    children.made.push(child);
    // Printed in chunks once the caller is listening, then the end, unless it was killed first.
    setTimeout(() => {
      for (const chunk of children.print) {
        if (child.kill.mock.calls.length > 0) return;
        child.stdout.emit("data", Buffer.from(chunk));
      }
      if (child.kill.mock.calls.length === 0) child.emit("close", 0);
    });
    return child;
  });
  return { ...actual, spawn };
});

afterEach(() => {
  children.made.length = 0;
  children.print = [];
});

const STREAMS = JSON.stringify({
  streams: [{ codec_type: "video", codec_name: "h264", profile: "High", level: 40, width: 1920, height: 1080, bit_rate: "8000000", duration: "2.000000", avg_frame_rate: "30/1" }],
  format: { duration: "2.000000", bit_rate: "8100000", tags: { "com.apple.quicktime.make": "Apple" } },
});

describe("probe", () => {
  it("reads a clip whose output is within the cap", async () => {
    children.print = [STREAMS];
    const streams = await probe("clip.mp4");
    expect(streams).toMatchObject({ codec: "h264", width: 1920, height: 1080, durationMs: 2000, fps: 30, tags: { "com.apple.quicktime.make": "Apple" } });
    expect((children.made[0] as Child).kill).not.toHaveBeenCalled();
  });

  it("kills ffprobe and finds the clip unsupported once its output passes the cap", async () => {
    const chunk = "x".repeat(64 * 1024);
    children.print = Array.from({ length: Math.ceil(PROBE_MAX_BYTES / chunk.length) + 2 }, () => chunk);
    await expect(probe("clip.mp4")).rejects.toThrow("unsupported");
    expect((children.made[0] as Child).kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("caps at about a megabyte", () => {
    expect(PROBE_MAX_BYTES).toBe(1024 * 1024);
  });
});
