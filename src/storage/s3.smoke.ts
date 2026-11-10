import { describe, expect, it } from "vitest";
import { storageConfig } from "./config";
import { s3Storage } from "./s3";

// The DOM typings know neither ReadableStream.from nor async iteration of a stream.
function fromPieces(pieces: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(piece);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (let read = await reader.read(); !read.done; read = await reader.read()) chunks.push(read.value);
  return Buffer.concat(chunks);
}

// The one test at the storage interface (spec, "Testing Decisions"): the S3 implementation
// against a real S3-compatible server, which checks every request's signature. The local-disk
// implementation is exercised by the browser tests. vitest.s3.config.ts says how to run it.
describe("S3-compatible storage", () => {
  it("stores a picture, reads it back, copies it, and deletes it", async () => {
    const config = storageConfig();
    if (config.backend !== "s3") throw new Error("The S3 smoke test needs STORAGE_BACKEND=s3 (vitest.s3.config.ts)");
    const storage = s3Storage(config);
    const key = `smoke-${crypto.randomUUID()}-background.webp`;
    const picture = Uint8Array.from({ length: 300_000 }, (_, at) => (at * 31) % 256);

    await storage.put(key, picture);
    expect(await storage.get(key)).toEqual(picture);
    // Its size, for the storage accounting (M7 ticket 02); nothing for a key that is not there.
    expect(await storage.stat(key)).toEqual({ size: picture.length });
    expect(await storage.stat(`smoke-${crypto.randomUUID()}-missing.webp`)).toBeUndefined();
    // A copy under another key reads back the same, and the original stays.
    const copied = `smoke-${crypto.randomUUID()}-poster.webp`;
    await storage.copy(key, copied);
    expect(await storage.get(copied)).toEqual(picture);
    expect(await storage.get(key)).toEqual(picture);
    await storage.delete(copied);
    await storage.delete(key);
    expect(await storage.get(key)).toBeUndefined();
    // A stream in, past one part (8 MiB, M7 ticket 04), so the upload goes up in parts; then read
    // back whole and by range, and nothing for a key that is not there.
    const streamed = `smoke-${crypto.randomUUID()}-video.mp4`;
    const large = Uint8Array.from({ length: 9 * 1024 * 1024 }, (_, at) => (at * 13) % 256);
    const pieces = Array.from({ length: 9 }, (_, index) => large.subarray(index * 1024 * 1024, (index + 1) * 1024 * 1024));
    await storage.putStream(streamed, fromPieces(pieces), large.length);
    expect(await storage.stat(streamed)).toEqual({ size: large.length });
    expect(await collect((await storage.stream(streamed))!)).toEqual(Buffer.from(large));
    expect(await collect((await storage.stream(streamed, { start: 1000, end: 1009 }))!)).toEqual(Buffer.from(large.subarray(1000, 1010)));
    expect(await storage.stream(`smoke-${crypto.randomUUID()}-video.mp4`)).toBeUndefined();
    await storage.delete(streamed);
    // Deleting what is already gone is not an error, as on local disk.
    await storage.delete(key);
    // The server checks signatures, so the round trip above was signed right.
    await expect(s3Storage({ ...config, secretKey: "not the secret" }).put(key, picture)).rejects.toThrow(/signature/i);
  });
});
