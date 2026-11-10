import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diskStorage } from "./disk";

// The local-disk implementation at the storage interface (M7 ticket 02; the S3 one has
// s3.smoke.ts), on a directory of its own that goes afterwards.
describe("local-disk storage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "openinvites-disk-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("stores bytes, reads them back, tells their size, and deletes them", async () => {
    const storage = diskStorage(dir);
    const bytes = Uint8Array.from({ length: 3000 }, (_, at) => at % 256);
    await storage.put("abc-photo.webp", bytes);
    expect(Array.from((await storage.get("abc-photo.webp"))!)).toEqual(Array.from(bytes));
    expect(await storage.stat("abc-photo.webp")).toEqual({ size: 3000 });
    await storage.delete("abc-photo.webp");
    expect(await storage.get("abc-photo.webp")).toBeUndefined();
    expect(await storage.stat("abc-photo.webp")).toBeUndefined();
    // Deleting what is already gone is not an error.
    await storage.delete("abc-photo.webp");
  });

  it("refuses a key that could reach outside the directory", async () => {
    const storage = diskStorage(dir);
    await expect(storage.put("../escape", new Uint8Array(1))).rejects.toThrow(/Not a storage key/);
    await expect(storage.stat(".hidden")).rejects.toThrow(/Not a storage key/);
  });
});
