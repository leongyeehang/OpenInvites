import { afterEach, describe, expect, it } from "vitest";
import { kindOf, missingParts, parseAskRequest, PART_BYTES, partBytes, partPlan, uploadComplete } from "./upload-protocol";

// One way to add anything to an album (M7 ticket 06): ask, send the parts, finish.
describe("partPlan", () => {
  it("counts the parts a file takes, one for a file that fits in a part or is empty", () => {
    expect(partPlan(0, 5)).toBe(1);
    expect(partPlan(5, 5)).toBe(1);
    expect(partPlan(6, 5)).toBe(2);
    expect(partPlan(12, 5)).toBe(3);
  });
});

describe("partBytes", () => {
  afterEach(() => {
    delete process.env.UPLOAD_TEST_PART_BYTES;
  });

  it("is 5 MB, or what the test profile sets", () => {
    expect(PART_BYTES).toBe(5 * 1024 * 1024);
    expect(partBytes()).toBe(PART_BYTES);
    process.env.UPLOAD_TEST_PART_BYTES = "65536";
    expect(partBytes()).toBe(65536);
  });
});

describe("kindOf", () => {
  it("takes a video type as a video and anything else as a photo", () => {
    expect(kindOf("video/mp4")).toBe("video");
    expect(kindOf("video/quicktime")).toBe("video");
    expect(kindOf("image/jpeg")).toBe("photo");
    expect(kindOf("")).toBe("photo");
  });
});

describe("uploadComplete", () => {
  it("is true once every part has arrived, whatever the order", () => {
    expect(uploadComplete([0, 1, 2], 3)).toBe(true);
    expect(uploadComplete([2, 0, 1, 1], 3)).toBe(true);
    expect(uploadComplete([0, 2], 3)).toBe(false);
    expect(uploadComplete([], 1)).toBe(false);
  });
});

describe("parseAskRequest", () => {
  it("reads a list of files with their name, size, type and optional length", () => {
    expect(parseAskRequest({ files: [{ name: "a.jpg", size: 10, type: "image/jpeg" }, { name: "b.mp4", size: 20, type: "video/mp4", durationMs: 4000 }] })).toEqual({
      files: [
        { name: "a.jpg", size: 10, type: "image/jpeg", durationMs: undefined },
        { name: "b.mp4", size: 20, type: "video/mp4", durationMs: 4000 },
      ],
    });
  });

  it("refuses what is not such a list, more than ten files, or a size that is not a whole number", () => {
    expect(parseAskRequest(null)).toBeUndefined();
    expect(parseAskRequest({ files: "x" })).toBeUndefined();
    expect(parseAskRequest({ files: [] })).toBeUndefined();
    expect(parseAskRequest({ files: Array.from({ length: 11 }, () => ({ name: "a", size: 1, type: "image/jpeg" })) })).toBeUndefined();
    expect(parseAskRequest({ files: [{ name: "a", size: -1, type: "image/jpeg" }] })).toBeUndefined();
    expect(parseAskRequest({ files: [{ name: "a", size: 1.5, type: "image/jpeg" }] })).toBeUndefined();
    expect(parseAskRequest({ files: [{ name: 3, size: 1, type: "image/jpeg" }] })).toBeUndefined();
  });

  it("keeps a name to 255 characters and treats a length that is not a positive number as unknown", () => {
    const parsed = parseAskRequest({ files: [{ name: "x".repeat(300), size: 1, type: "video/mp4", durationMs: "4" }] });
    expect(parsed?.files[0].name).toHaveLength(255);
    expect(parsed?.files[0].durationMs).toBeUndefined();
  });
});

// A resume after a dropped connection (M7 ticket 07): the parts still to send, in order.
describe("missingParts", () => {
  it("lists the parts not yet received, in order, and none once all are", () => {
    expect(missingParts([0, 2], 4)).toEqual([1, 3]);
    expect(missingParts([], 2)).toEqual([0, 1]);
    expect(missingParts([1, 0], 2)).toEqual([]);
  });
});
