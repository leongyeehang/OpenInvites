import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diskUseOf, freeBytesOf } from "./disk-space";

// What the free-disk rule and the Storage card read from local disk (M7 ticket 02).
describe("free space and use on local disk", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "openinvites-space-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads the free space of the volume a directory is on", async () => {
    expect(await freeBytesOf(dir)).toBeGreaterThan(0);
  });

  it("reads the parent's free space while the directory does not exist yet", async () => {
    expect(await freeBytesOf(join(dir, "uploads"))).toBeGreaterThan(0);
    expect(await freeBytesOf(join(dir, "not", "yet", "there"))).toBeGreaterThan(0);
  });

  it("sums the sizes of the files in the directory, and reads zero for one that does not exist", async () => {
    await writeFile(join(dir, "a-photo.webp"), Buffer.alloc(1000));
    await writeFile(join(dir, "b-poster.webp"), Buffer.alloc(500));
    expect(await diskUseOf(dir)).toBe(1500);
    expect(await diskUseOf(join(dir, "missing"))).toBe(0);
  });
});
