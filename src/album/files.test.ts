import { describe, expect, it } from "vitest";
import { namedBy, strayKeys } from "@/storage/strays";
import { motionKey, motionSentKey, photoKey } from "./files";

// M8 ticket 08: the keys a live photo's files are stored under are the names the stray-file check
// keeps for a photo, so a key and a name that drift apart fail here rather than on an operator's
// Storage card.

const NOW = new Date("2026-11-11T12:00:00Z");
const ID = "019a0000-0000-7abc-8def-0123456789ab";
const stored = (key: string) => ({ key, size: 1000, modifiedAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000) });

describe("a live photo's files in storage", () => {
  it("are none of them stray for a photo, and its motion is stray for a video", () => {
    const keys = [photoKey(ID, "large"), photoKey(ID, "thumb"), motionKey(ID), motionSentKey(ID)];
    expect(strayKeys(keys.map(stored), (_id, file) => namedBy("photo", file), NOW)).toEqual([]);
    expect(strayKeys([stored(motionKey(ID))], (_id, file) => namedBy("video", file), NOW)).toEqual([{ key: motionKey(ID), size: 1000 }]);
  });
});
