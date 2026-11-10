import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diskStorage } from "./disk";

// The DOM typings know neither ReadableStream.from nor async iteration of a stream.
function fromPieces(pieces: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(piece);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) chunks.push(read.value);
  return Buffer.concat(chunks);
}

// The local-disk implementation at the storage interface (M7 ticket 02; the S3 one has
// s3.smoke.ts), on a directory of its own that goes afterwards.
describe("local-disk storage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "openinvites-disk-"));
  });

  // M7 ticket 10: the stray-file check lists what the directory holds, with each file's size and
  // when it was written; a directory among the files is not a file.
  it("lists every file with its size and when it was written", async () => {
    const storage = diskStorage(dir);
    await storage.put("a-photo.webp", new Uint8Array(10));
    await storage.put("b-video.mp4", new Uint8Array(20));
    const listed: { key: string; size: number; modifiedAt: Date }[] = [];
    for await (const file of storage.list()) listed.push(file);
    listed.sort((one, two) => one.key.localeCompare(two.key));
    expect(listed.map(({ key, size }) => ({ key, size }))).toEqual([
      { key: "a-photo.webp", size: 10 },
      { key: "b-video.mp4", size: 20 },
    ]);
    for (const { modifiedAt } of listed) expect(Math.abs(Date.now() - modifiedAt.getTime())).toBeLessThan(60_000);
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

  // M7 ticket 04: a stream in, and ranges out.
  it("stores what a stream carries, in pieces, and reads it back whole or by range", async () => {
    const storage = diskStorage(dir);
    const bytes = Uint8Array.from({ length: 70_000 }, (_, at) => (at * 7) % 256);
    const pieces = [bytes.subarray(0, 30_000), bytes.subarray(30_000, 60_000), bytes.subarray(60_000)];
    await storage.putStream("v1-video.mp4", fromPieces(pieces), bytes.length);
    expect(await storage.stat("v1-video.mp4")).toEqual({ size: 70_000 });
    expect(Array.from(await collect((await storage.stream("v1-video.mp4"))!))).toEqual(Array.from(bytes));
    expect(Array.from(await collect((await storage.stream("v1-video.mp4", { start: 29_998, end: 30_002 }))!))).toEqual(Array.from(bytes.subarray(29_998, 30_003)));
    expect(await storage.stream("v1-missing.mp4")).toBeUndefined();
    // Nothing half-written is ever stored under the key itself.
    expect(await storage.stat("v1-video.mp4.partial")).toBeUndefined();
  });

  it("refuses a key that could reach outside the directory", async () => {
    const storage = diskStorage(dir);
    await expect(storage.put("../escape", new Uint8Array(1))).rejects.toThrow(/Not a storage key/);
    await expect(storage.stat(".hidden")).rejects.toThrow(/Not a storage key/);
  });
});
