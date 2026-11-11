import { and, count, eq, isNull } from "drizzle-orm";
import { PHOTO_FILES } from "@/album/files";
import { getDb, type Db } from "@/db/client";
import { photo, upload } from "@/db/schema";
import { RENDITIONS } from "@/uploads/renditions";
import { getStorage } from "./storage";

// The one-time measuring after the 0.7 upgrade (M7 ticket 02): items and pictures from before it
// have no recorded size, so the first start after it reads each one's files from storage, in the
// background, and records what is stored. What was sent is gone, so the stored files stand in
// for it: a close estimate, which the operator docs say.

export type Unsized = { id: string; kind: "photo" | "picture" };

const FILES: Record<Unsized["kind"], readonly string[]> = {
  photo: Object.values(PHOTO_FILES).map((each) => each.file),
  picture: Object.values(RENDITIONS).map((each) => each.file),
};

// The stored files of each row summed, a missing file counting nothing, so a row whose files are
// all gone is measured as 0 and never asked about again.
export async function measureUnsized(rows: Unsized[], stat: (key: string) => Promise<{ size: number } | undefined>): Promise<{ id: string; bytes: number }[]> {
  return Promise.all(
    rows.map(async ({ id, kind }) => {
      const sizes = await Promise.all(FILES[kind].map((file) => stat(`${id}-${file}`)));
      return { id, bytes: sizes.reduce((total, each) => total + (each?.size ?? 0), 0) };
    }),
  );
}

// How many files are still to be measured, for the Storage card (ticket 03).
export async function unmeasuredCount(db: Db = getDb()): Promise<number> {
  const [{ photos }] = await db.select({ photos: count() }).from(photo).where(isNull(photo.bytes));
  const [{ pictures }] = await db.select({ pictures: count() }).from(upload).where(isNull(upload.bytes));
  return photos + pictures;
}

const BATCH = 100;

// Started from instrumentation.ts after the clock, not awaited: the site answers requests while it
// measures. Two containers measuring the same rows write the same numbers.
export function measureAtStart(): void {
  void measureAll().catch((error) => console.error("Storage: measuring the files from before the upgrade failed:", error));
}

async function measureAll(): Promise<void> {
  const db = getDb();
  const stat = (key: string) => getStorage().stat(key);
  let measured = 0;
  for (;;) {
    const rows: Unsized[] = (await db.select({ id: photo.id }).from(photo).where(isNull(photo.bytes)).limit(BATCH)).map(({ id }) => ({ id, kind: "photo" }));
    if (rows.length < BATCH) {
      const pictures = await db.select({ id: upload.id }).from(upload).where(isNull(upload.bytes)).limit(BATCH - rows.length);
      rows.push(...pictures.map(({ id }) => ({ id, kind: "picture" as const })));
    }
    if (rows.length === 0) break;
    const kinds = new Map(rows.map((row) => [row.id, row.kind]));
    for (const { id, bytes } of await measureUnsized(rows, stat)) {
      const table = kinds.get(id) === "photo" ? photo : upload;
      await db.update(table).set({ bytes }).where(and(eq(table.id, id), isNull(table.bytes)));
    }
    measured += rows.length;
    console.log(`Storage: measured ${rows.length} files from before the upgrade (${measured} so far).`);
  }
  if (measured > 0) console.log(`Storage: measuring done, ${measured} files.`);
}
