import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { removeAbandonedUploads } from "./repository";
import { removeDir, UPLOADS_ROOT } from "./tmp";

const DAY = 24 * 60 * 60 * 1000;

// The hourly sweep's step for uploads never finished (M7 ticket 06): their rows go after a day,
// which releases the places and bytes they held, and their parts with them. Parts on this
// container are also removed by age alone, since another container's rows may name them, or a
// crash may have left them with no row at all.
export async function sweepAbandonedUploads(now: Date): Promise<void> {
  for (const id of await removeAbandonedUploads(now)) await removeDir(join(UPLOADS_ROOT, id));
  let dirs: string[];
  try {
    dirs = await readdir(UPLOADS_ROOT);
  } catch {
    return;
  }
  for (const dir of dirs) {
    const path = join(UPLOADS_ROOT, dir);
    const info = await stat(path).catch(() => undefined);
    if (info && now.getTime() - info.mtimeMs > DAY) await removeDir(path);
  }
}
