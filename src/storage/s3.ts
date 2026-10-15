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
    async get(key) {
      try {
        return new Uint8Array(await (await client.getObject(key)).arrayBuffer());
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
