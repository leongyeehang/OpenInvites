import { S3Client, S3Errors } from "@bradenmacdonald/s3-lite-client";
import type { StorageConfig } from "./config";
import type { Storage } from "./storage";

// S3-compatible object storage: AWS S3, Cloudflare R2, Backblaze B2, MinIO, Garage and the like.
// Requests are path-style (endpoint/bucket/key), which every one of them accepts. The bucket can
// stay private: guests are served the files by the application, not by the bucket.
export function s3Storage({ endpoint, region, bucket, accessKey, secretKey }: Extract<StorageConfig, { backend: "s3" }>): Storage {
  const client = new S3Client({ endPoint: endpoint, region, bucket, accessKey, secretKey, pathStyle: true });
  return {
    async put(key, body) {
      // The client takes bytes over a plain ArrayBuffer only.
      await client.putObject(key, new Uint8Array(body));
    },
    // The client plans parts of 64 MiB with four in flight, about 256 MiB of heap per upload;
    // 8 MiB keeps that near 32 MiB and still reaches 80 GB, far past any limit (M7 ticket 04).
    async putStream(key, body, size) {
      await client.putObject(key, body, { size, partSize: 8 * 1024 * 1024 });
    },
    async get(key) {
      try {
        return new Uint8Array(await (await client.getObject(key)).arrayBuffer());
      } catch (error) {
        if (error instanceof S3Errors.ServerError && error.statusCode === 404) return undefined;
        throw error;
      }
    },
    // A range is one request with a Range header, which the client sends for an offset or a
    // length; the whole file is asked for plainly (the client expects 200 then, 206 otherwise).
    async stream(key, range) {
      try {
        const response = await client.getPartialObject(key, range ? { offset: range.start, length: range.end - range.start + 1 } : { offset: 0, length: 0 });
        return response.body ?? undefined;
      } catch (error) {
        if (error instanceof S3Errors.ServerError && error.statusCode === 404) return undefined;
        throw error;
      }
    },
    async stat(key) {
      try {
        const { size } = await client.statObject(key);
        return { size };
      } catch (error) {
        if (error instanceof S3Errors.ServerError && error.statusCode === 404) return undefined;
        throw error;
      }
    },
    async delete(key) {
      // Deleting a key that is not there succeeds, as S3 defines it.
      await client.deleteObject(key);
    },
    async copy(fromKey, toKey) {
      // Done by the server: the bytes never come to the application.
      await client.copyObject({ sourceKey: fromKey }, toKey);
    },
  };
}
