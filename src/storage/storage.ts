import { storageConfig, type StorageConfig } from "./config";
import { diskStorage } from "./disk";
import { s3Storage } from "./s3";

// The one way the application reads and writes uploaded files (ADR-0003). Nothing else touches
// the disk directory or the bucket, so the two implementations are interchangeable. A key is a
// flat file name the application makes; what is stored under it is bytes.
export type Storage = {
  put(key: string, body: Uint8Array): Promise<void>;
  // Nothing stored under the key is not an error.
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<void>;
  // The bytes under one key, also under another, without passing through the application on S3.
  // The key copied from must exist.
  copy(fromKey: string, toKey: string): Promise<void>;
};

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
