import { afterEach, describe, expect, it } from "vitest";
import { processesVideosHere, videoProcessingMode, videoRole } from "./env";

// Where the album's videos are processed (M7 ticket 08): in the app container, or in a worker
// container from the same image, which runs in the worker role.
afterEach(() => {
  delete process.env.VIDEO_PROCESSING;
  delete process.env.VIDEO_ROLE;
});

describe("videoProcessingMode", () => {
  it("is the app unless the operator says worker", () => {
    expect(videoProcessingMode()).toBe("app");
    process.env.VIDEO_PROCESSING = "app";
    expect(videoProcessingMode()).toBe("app");
    process.env.VIDEO_PROCESSING = " worker ";
    expect(videoProcessingMode()).toBe("worker");
  });

  it("refuses anything else at start, naming the value", () => {
    process.env.VIDEO_PROCESSING = "elsewhere";
    expect(() => videoProcessingMode()).toThrow(/VIDEO_PROCESSING must be "app" or "worker", not "elsewhere"/);
  });
});

describe("videoRole", () => {
  it("is the app unless the launcher says worker", () => {
    expect(videoRole()).toBe("app");
    process.env.VIDEO_ROLE = "worker";
    expect(videoRole()).toBe("worker");
    process.env.VIDEO_ROLE = "other";
    expect(videoRole()).toBe("app");
  });
});

describe("processesVideosHere", () => {
  it("is the app in app mode, and only the worker in worker mode", () => {
    expect(processesVideosHere()).toBe(true);
    process.env.VIDEO_PROCESSING = "worker";
    expect(processesVideosHere()).toBe(false);
    process.env.VIDEO_ROLE = "worker";
    expect(processesVideosHere()).toBe(true);
    process.env.VIDEO_PROCESSING = "app";
    expect(processesVideosHere()).toBe(true);
  });
});
