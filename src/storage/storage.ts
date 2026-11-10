import { storageConfig, type StorageConfig } from "./config";
import { diskStorage } from "./disk";
import { s3Storage } from "./s3";

// The one way the application reads and writes uploaded files (ADR-0003). Nothing else touches
// the disk directory or the bucket, so the two implementations are interchangeable. A key is a
// flat file name the application makes; what is stored under it is bytes, whole for a picture,
// and as a stream for a video (M7 ticket 04), which never passes through memory whole.
export type Storage = {
  put(key: string, body: Uint8Array): Promise<void>;
  // Stores what the stream carries; `size` is what the sender declared, which S3 needs to plan
  // its parts. A reader never sees a half-written file.
  putStream(key: string, body: ReadableStream<Uint8Array>, size: number): Promise<void>;
  // Nothing stored under the key is not an error.
  get(key: string): Promise<Uint8Array | undefined>;
  // The bytes under the key as a stream, or the range (`end` inclusive) the caller has already
  // clamped to the file's size; undefined when nothing is stored under the key.
  stream(key: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array> | undefined>;
  // The size of what is stored under the key, for the storage accounting (M7 ticket 02).
  stat(key: string): Promise<{ size: number } | undefined>;
  delete(key: string): Promise<void>;
  // The bytes under one key, also under another, without passing through the application on S3.
  // The key copied from must exist.
  copy(fromKey: string, toKey: string): Promise<void>;
  // Every key stored, with its size and when it was written, for the stray-file check (M7 ticket
  // 10), which reads the whole listing once; a bucket of tens of thousands of files takes seconds.
  list(): AsyncIterable<StoredFile>;
};

export type StoredFile = { key: string; size: number; modifiedAt: Date };

function create(config: StorageConfig): Storage {
  return config.backend === "s3" ? s3Storage(config) : diskStorage(config.dir);
}

// Chosen from the environment on first use, not at import: `next build` loads route modules
// with nothing configured.
let storage: Storage | undefined;

export function getStorage(): Storage {
  storage ??= create(storageConfig());
  return storage;
}
