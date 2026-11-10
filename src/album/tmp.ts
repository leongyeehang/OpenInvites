import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Temporary files (M7 ticket 06; plan ruling 17): the parts of an upload in progress, and the
// scratch ffmpeg works in. Under the system's temporary directory, which the image leaves writable
// to the app's user, not the uploads volume, which holds only what the storage interface stores.
// The operator docs say /tmp needs about three times the largest video free, and that the site
// runs one app container, since parts live on the container that took them.

const ROOT = join(tmpdir(), "openinvites");
export const UPLOADS_ROOT = join(ROOT, "uploads");
const SCRATCH_ROOT = join(ROOT, "scratch");

// Where an upload's parts are kept, made on first use. The id is the random token the browser
// holds, letters, digits, hyphens and underscores only (upload-protocol.ts).
export async function uploadDir(uploadId: string): Promise<string> {
  const dir = join(UPLOADS_ROOT, uploadId);
  await mkdir(dir, { recursive: true });
  return dir;
}

// A directory of its own for one processing job, which the job removes when done.
export async function scratchDir(label: string): Promise<string> {
  await mkdir(SCRATCH_ROOT, { recursive: true });
  return mkdtemp(join(SCRATCH_ROOT, `${label}-`));
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
