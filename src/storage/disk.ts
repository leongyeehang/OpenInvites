import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Storage } from "./storage";

// Keys are flat file names; anything else (a slash, a leading dot) could reach outside the
// directory, and no caller has a reason to send one.
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Local disk, the default: one directory, which is a Docker volume in the image.
export function diskStorage(dir: string): Storage {
  const root = resolve(dir);
  const path = (key: string) => {
    if (!KEY.test(key)) throw new Error(`Not a storage key: ${JSON.stringify(key)}`);
    return join(root, key);
  };
  return {
    async put(key, body) {
      await mkdir(root, { recursive: true });
      await writeFile(path(key), body);
    },
    async get(key) {
      try {
        return await readFile(path(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    async delete(key) {
      await rm(path(key), { force: true });
    },
  };
}
