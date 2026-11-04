import sharp from "sharp";
import { getStorage } from "@/storage/storage";
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

function key(id: string, name: PhotoFile): string {
  return `${id}-${PHOTO_FILES[name].file}`;
}

export function photoUrl(id: string, name: PhotoFile): string {
  return `/uploads/${id}/${PHOTO_FILES[name].file}`;
}

export type ProcessedPhoto = { width: number; height: number; files: Record<PhotoFile, Uint8Array> };

// A photo as sent, checked by its content and size, upright, re-encoded at the album's two sizes.
export async function processPhoto(bytes: Uint8Array, maxBytes: number): Promise<{ ok: true; photo: ProcessedPhoto } | { ok: false; problem: UploadProblem }> {
  const problem = uploadProblem(bytes, maxBytes);
  if (problem) return { ok: false, problem };
  if (!imageTypeOf(bytes)) return { ok: false, problem: "unsupported" };
  let size: { width: number; height: number };
  try {
    ({ autoOrient: size } = await sharp(bytes, { limitInputPixels: false }).metadata());
  } catch {
    return { ok: false, problem: "unsupported" };
  }
  const tooMany = pixelProblem(size);
  if (tooMany) return { ok: false, problem: tooMany };
  try {
    const decode = () => sharp(bytes, { limitInputPixels: MAX_PIXELS }).autoOrient().flatten({ background: "#ffffff" }).toColourspace("srgb");
    const large = await decode().resize(LARGE, LARGE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await decode().resize(THUMB, THUMB, { fit: "cover", position: "attention" }).webp({ quality: 74 }).toBuffer();
    return { ok: true, photo: { width: large.info.width, height: large.info.height, files: { large: large.data, thumb } } };
  } catch {
    return { ok: false, problem: "unsupported" };
  }
}

export async function storePhoto(id: string, files: Record<PhotoFile, Uint8Array>): Promise<void> {
  await Promise.all(NAMES.map((name) => getStorage().put(key(id, name), files[name])));
}

export function readPhotoFile(id: string, name: PhotoFile): Promise<Uint8Array | undefined> {
  return getStorage().get(key(id, name));
}

// Removes photos' files once their rows are gone. A file that will not go is left where no page
// reaches it, and logged for the operator.
export async function removePhotoFiles(ids: string[]): Promise<void> {
  const removals = ids.flatMap((id) => NAMES.map((name) => getStorage().delete(key(id, name))));
  for (const removal of await Promise.allSettled(removals)) {
    if (removal.status === "rejected") console.error("A photo's file could not be removed:", removal.reason);
  }
}
