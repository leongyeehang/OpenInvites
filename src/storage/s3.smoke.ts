import { describe, expect, it } from "vitest";
import { storageConfig } from "./config";
import { s3Storage } from "./s3";

// The one test at the storage interface (spec, "Testing Decisions"): the S3 implementation
// against a real S3-compatible server, which checks every request's signature. The local-disk
// implementation is exercised by the browser tests. vitest.s3.config.ts says how to run it.
describe("S3-compatible storage", () => {
  it("stores a picture, reads it back, and deletes it", async () => {
    const config = storageConfig();
    if (config.backend !== "s3") throw new Error("The S3 smoke test needs STORAGE_BACKEND=s3 (vitest.s3.config.ts)");
    const storage = s3Storage(config);
    const key = `smoke-${crypto.randomUUID()}-background.webp`;
    const picture = Uint8Array.from({ length: 300_000 }, (_, at) => (at * 31) % 256);

    await storage.put(key, picture);
    expect(await storage.get(key)).toEqual(picture);
    await storage.delete(key);
    expect(await storage.get(key)).toBeUndefined();
    // Deleting what is already gone is not an error, as on local disk.
    await storage.delete(key);
    // The server checks signatures, so the round trip above was signed right.
    await expect(s3Storage({ ...config, secretKey: "not the secret" }).put(key, picture)).rejects.toThrow(/signature/i);
  });
});
