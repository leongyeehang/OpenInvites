import { MOTION_FILE, MOTION_SENT, PHOTO_FILES } from "@/album/files";
import { SENT_FILE, VIDEO_FILES } from "@/album/video";
import { getDb } from "@/db/client";
import { photo, upload } from "@/db/schema";
import { uuidv7Time } from "@/lib/uuid";
import { RENDITIONS } from "@/uploads/renditions";
import { STORAGE_KEY } from "./disk";
import { getStorage, type StoredFile } from "./storage";

// The stray-file check (M7 ticket 10; plan ruling 10: a button on the Storage card, not a script):
// what storage holds that no photo, video or host's picture names, old enough that no upload in
// progress could still be about to name it. Found on the operator's press, removed on their
// confirmation, never by the clock.

export const STRAY_MIN_AGE_MS = 60 * 60 * 1000;

const ID_AND_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/;

// Which of the files are stray: a key is `{id}-{file}`; one whose id was made under `minAgeMs`
// ago, or that was written under `minAgeMs` ago, is left alone, since an upload stores its files
// before their rows; one `named` says an item names is kept; everything else is stray, a key of
// another shape and a half-written file older than the hour included.
export function strayKeys(
  files: Pick<StoredFile, "key" | "size" | "modifiedAt">[],
  named: (id: string, file: string) => boolean,
  now: Date,
  minAgeMs = STRAY_MIN_AGE_MS,
): { key: string; size: number }[] {
  const young = (time: Date | undefined) => time !== undefined && now.getTime() - time.getTime() < minAgeMs;
  return files
    .filter(({ key, modifiedAt }) => {
      if (young(modifiedAt)) return false;
      const match = ID_AND_FILE.exec(key);
      if (!match) return true;
      const [, id, file] = match;
      if (young(uuidv7Time(id))) return false;
      return !named(id, file);
    })
    .map(({ key, size }) => ({ key, size }));
}

type Kind = "photo" | "video" | "picture";

// A photo's names include a live photo's motion and its clip as sent (M8 ticket 08), which only a
// live photo, or one whose motion is being made, has.
const NAMES: Record<Kind, Set<string>> = {
  photo: new Set([...Object.values(PHOTO_FILES).map(({ file }) => file), MOTION_FILE.file, MOTION_SENT]),
  video: new Set([...Object.values(VIDEO_FILES).map(({ file }) => file), SENT_FILE]),
  picture: new Set(Object.values(RENDITIONS).map(({ file }) => file)),
};

// Whether an item or picture of `kind` names `file`.
export function namedBy(kind: Kind, file: string): boolean {
  return NAMES[kind].has(file);
}

// Every id storage may hold files under, with its kind: the album's items and the hosts' pictures.
// An upload in progress has a token of its own that names no file (its parts are in a temporary
// directory), and the item it becomes is stored under the item's id, young enough to be skipped.
async function knownIds(): Promise<Map<string, Kind>> {
  const db = getDb();
  const [items, pictures] = await Promise.all([db.select({ id: photo.id, kind: photo.kind }).from(photo), db.select({ id: upload.id }).from(upload)]);
  const known = new Map<string, Kind>();
  for (const { id, kind } of items) known.set(id, kind);
  for (const { id } of pictures) known.set(id, "picture");
  return known;
}

export async function findStrayFiles(now = new Date()): Promise<{ files: { key: string; size: number }[]; total: number }> {
  const known = await knownIds();
  const files: StoredFile[] = [];
  for await (const file of getStorage().list()) files.push(file);
  const strays = strayKeys(files, (id, file) => known.has(id) && namedBy(known.get(id)!, file), now);
  return { files: strays, total: strays.reduce((sum, { size }) => sum + size, 0) };
}

// Removes the keys given, those of a storage key's shape; how many were asked to go.
export async function removeStrayFiles(keys: string[]): Promise<number> {
  const removable = keys.filter((key) => STORAGE_KEY.test(key));
  for (const key of removable) await getStorage().delete(key);
  return removable.length;
}
