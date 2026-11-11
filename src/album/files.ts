import sharp from "sharp";
import { getStorage } from "@/storage/storage";
import { sentKey, VIDEO_FILE_NAMES, videoKey } from "./video";
import { imageTypeOf, MAX_PIXELS, pixelProblem, uploadProblem, type UploadProblem } from "@/uploads/validate";

// A photo's files (M4 ticket 11), through the storage interface (ADR-0003), beside the posters'
// and under the same /uploads/{id}/{file} route: the photo at up to 2048 pixels for the viewer and
// Download, and a square thumbnail for the album's grid. The file sent is never kept: re-encoded,
// nothing of the camera or the place survives.
export const PHOTO_FILES = {
  large: { file: "photo.webp", type: "image/webp" },
  thumb: { file: "photo-thumb.webp", type: "image/webp" },
} as const;

export type PhotoFile = keyof typeof PHOTO_FILES;

const NAMES = Object.keys(PHOTO_FILES) as PhotoFile[];
const LARGE = 2048;
const THUMB = 480;

export function photoFileNamed(file: string): PhotoFile | undefined {
  return NAMES.find((name) => PHOTO_FILES[name].file === file);
}

// Where a photo's file is kept: one flat name per file (storage/disk.ts).
export function photoKey(id: string, name: PhotoFile): string {
  return `${id}-${PHOTO_FILES[name].file}`;
}

export function photoUrl(id: string, name: PhotoFile): string {
  return `/uploads/${id}/${PHOTO_FILES[name].file}`;
}

// The photo as processed: the large file's size; the picture's own size as added, upright, for the
// technical line (M8 ticket 07); and the raw EXIF block, which no stored file keeps, for the
// details the host keeps (exif.ts, readExif), when the photo carries one.
export type ProcessedPhoto = { width: number; height: number; pixels: { width: number; height: number }; exif?: Uint8Array; files: Record<PhotoFile, Uint8Array> };

// A photo as sent, checked by its content and size, upright, re-encoded at the album's two sizes.
export async function processPhoto(bytes: Uint8Array, maxBytes: number): Promise<{ ok: true; photo: ProcessedPhoto } | { ok: false; problem: UploadProblem }> {
  const problem = uploadProblem(bytes, maxBytes);
  if (problem) return { ok: false, problem };
  if (!imageTypeOf(bytes)) return { ok: false, problem: "unsupported" };
  let size: { width: number; height: number };
  let exif: Uint8Array | undefined;
  try {
    ({ autoOrient: size, exif } = await sharp(bytes, { limitInputPixels: false }).metadata());
  } catch {
    return { ok: false, problem: "unsupported" };
  }
  const tooMany = pixelProblem(size);
  if (tooMany) return { ok: false, problem: tooMany };
  try {
    const decode = () => sharp(bytes, { limitInputPixels: MAX_PIXELS }).autoOrient().flatten({ background: "#ffffff" }).toColourspace("srgb");
    const large = await decode().resize(LARGE, LARGE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await decode().resize(THUMB, THUMB, { fit: "cover", position: "attention" }).webp({ quality: 74 }).toBuffer();
    return { ok: true, photo: { width: large.info.width, height: large.info.height, pixels: { width: size.width, height: size.height }, exif, files: { large: large.data, thumb } } };
  } catch {
    return { ok: false, problem: "unsupported" };
  }
}

export async function storePhoto(id: string, files: Record<PhotoFile, Uint8Array>): Promise<void> {
  await Promise.all(NAMES.map((name) => getStorage().put(photoKey(id, name), files[name])));
}

// Removes items' files once their rows are gone: every photo name and, since M7 (ticket 05), every
// video name, the file as sent included, since deleting a missing key is not an error on either
// backend and the caller need not know the item's kind. A file that will not go is left where no
// page reaches it, and logged for the operator.
export async function removeItemFiles(ids: string[]): Promise<void> {
  const removals = ids.flatMap((id) => [
    ...NAMES.map((name) => getStorage().delete(photoKey(id, name))),
    ...VIDEO_FILE_NAMES.map((name) => getStorage().delete(videoKey(id, name))),
    getStorage().delete(sentKey(id)),
  ]);
  for (const removal of await Promise.allSettled(removals)) {
    if (removal.status === "rejected") console.error("An item's file could not be removed:", removal.reason);
  }
}
