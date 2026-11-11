import { readdir, stat, statfs } from "node:fs/promises";
import { dirname, join } from "node:path";

// What the free-disk rule and the Storage card read from local disk (M7 ticket 02). Both take the
// directory as a path; storage/usage.ts resolves it from the storage configuration.

// The free space of the volume the directory is on. The directory may not exist yet (diskStorage
// makes it on the first put), so the nearest parent that does is asked; undefined only when
// nothing up to the root can be read.
export async function freeBytesOf(dir: string): Promise<number | undefined> {
  let at = dir;
  for (;;) {
    try {
      const volume = await statfs(at);
      return Number(volume.bavail) * Number(volume.bsize);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(at);
      if (parent === at) return undefined;
      at = parent;
    }
  }
}

// The sizes of the files in the directory, summed: keys are flat names, so there is nothing below.
export async function diskUseOf(dir: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let total = 0;
  for (const entry of entries) {
    if (entry.isFile()) total += await sizeOf(join(dir, entry.name));
  }
  return total;
}

// A file's size, or zero for one that went after the directory was listed: an album item deleted
// meanwhile, or a partial renamed onto its key. It is absent, never an error on the page that
// asked (M8 ticket 09).
async function sizeOf(file: string): Promise<number> {
  try {
    return (await stat(file)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}
