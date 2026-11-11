import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { Storage } from "./storage";

// Keys are flat file names; anything else (a slash, a leading dot) could reach outside the
// directory, and no caller has a reason to send one.
export const STORAGE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const KEY = STORAGE_KEY;

// Local disk, the default: one directory, which is a Docker volume in the image.
export function diskStorage(dir: string): Storage {
  const root = resolve(dir);
  const path = (key: string) => {
    if (!KEY.test(key)) throw new Error(`Not a storage key: ${JSON.stringify(key)}`);
    return join(root, key);
  };
  const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
  return {
    async put(key, body) {
      await mkdir(root, { recursive: true });
      await writeFile(path(key), body);
    },
    // Written beside the key under a name of its own and renamed onto it when complete, in the
    // same directory, so a reader never finds a half-written file under the key (M7 ticket 04).
    async putStream(key, body) {
      await mkdir(root, { recursive: true });
      const partial = path(`${key}.partial`);
      try {
        await pipeline(Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>), createWriteStream(partial));
      } catch (error) {
        await rm(partial, { force: true });
        throw error;
      }
      await rename(partial, path(key));
    },
    async get(key) {
      try {
        return await readFile(path(key));
      } catch (error) {
        if (missing(error)) return undefined;
        throw error;
      }
    },
    async stream(key, range) {
      const file = path(key);
      try {
        await stat(file);
      } catch (error) {
        if (missing(error)) return undefined;
        throw error;
      }
      return Readable.toWeb(createReadStream(file, range && { start: range.start, end: range.end })) as unknown as ReadableStream<Uint8Array>;
    },
    async stat(key) {
      try {
        const { size } = await stat(path(key));
        return { size };
      } catch (error) {
        if (missing(error)) return undefined;
        throw error;
      }
    },
    async delete(key) {
      await rm(path(key), { force: true });
    },
    async copy(fromKey, toKey) {
      await copyFile(path(fromKey), path(toKey));
    },
    // The directory's files, one stat each; what is not a file, or has no key's shape, is skipped.
    async *list() {
      let names: string[];
      try {
        names = await readdir(root);
      } catch (error) {
        if (missing(error)) return;
        throw error;
      }
      for (const name of names) {
        if (!KEY.test(name)) continue;
        const found = await stat(join(root, name)).catch(() => undefined);
        if (found?.isFile()) yield { key: name, size: found.size, modifiedAt: found.mtime };
      }
    },
  };
}
