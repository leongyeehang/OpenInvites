import { describe, expect, it } from "vitest";
import { measureUnsized } from "./measure";

// The one-time measuring after the 0.7 upgrade (M7 ticket 02): what is stored for each item or
// picture, since what was sent is gone.
describe("measureUnsized", () => {
  it("sums the stored files of each photo and picture, a missing file counting nothing", async () => {
    const sizes: Record<string, number> = { "p1-photo.webp": 1000, "p1-photo-thumb.webp": 200, "u1-background.webp": 5000, "u1-poster.webp": 3000 };
    const stat = async (key: string) => (key in sizes ? { size: sizes[key] } : undefined);
    expect(await measureUnsized([{ id: "p1", kind: "photo" }, { id: "u1", kind: "picture" }, { id: "gone", kind: "photo" }], stat)).toEqual([
      { id: "p1", bytes: 1200 },
      { id: "u1", bytes: 8000 },
      { id: "gone", bytes: 0 },
    ]);
  });

  it("asks for every photo file and every rendition of a picture", async () => {
    const asked: string[] = [];
    const stat = async (key: string) => {
      asked.push(key);
      return { size: 1 };
    };
    await measureUnsized([{ id: "p", kind: "photo" }, { id: "u", kind: "picture" }], stat);
    expect(asked.sort()).toEqual(["p-photo-thumb.webp", "p-photo.webp", "u-background-portrait.webp", "u-background.webp", "u-card.jpg", "u-poster-720.webp", "u-poster-copy.webp", "u-poster.webp"]);
  });
});
