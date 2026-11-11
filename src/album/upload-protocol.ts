import { MEGABYTE } from "@/lib/sizes";
import type { UploadProblem } from "@/uploads/validate";
import { MAX_PHOTOS_AT_ONCE } from "./album";
import type { PhotoKind } from "./video";

// One way to add anything to an album (M7 ticket 06): the browser asks for a batch of uploads,
// sends each file in parts, and finishes each; the server reserves the album's places and bytes
// at the ask, keeps the parts on its disk, and makes the item at the finish. One file is in memory
// at a time, never a whole post of ten. These are the wire shapes both sides read.

export const PART_BYTES = 5 * MEGABYTE;

// The test profile's `app` sets a tiny part so a small clip spans several (compose.yaml).
export function partBytes(): number {
  const test = process.env.UPLOAD_TEST_PART_BYTES;
  const bytes = Number(test);
  return test && Number.isInteger(bytes) && bytes > 0 ? bytes : PART_BYTES;
}

// How many parts a file takes: one for a file that fits in a part, or is empty.
export function partPlan(size: number, partSize: number): number {
  return Math.max(1, Math.ceil(size / partSize));
}

// What the browser said the file was: a video by its type, anything else a photo, which the
// server then checks by the bytes (uploads/validate.ts).
export function kindOf(type: string): PhotoKind {
  return type.startsWith("video/") ? "video" : "photo";
}

export function uploadComplete(received: number[], parts: number): boolean {
  const have = new Set(received);
  for (let part = 0; part < parts; part += 1) if (!have.has(part)) return false;
  return true;
}

export type AskFile = { name: string; size: number; type: string; durationMs: number | undefined };
export type AskRequest = { files: AskFile[] };

const NAME_MAX = 255;

// The ask's body, or nothing for what is not one: a list of one to ten files, each with a name, a
// whole size, a type, and the length the browser read if it could (a video's).
export function parseAskRequest(body: unknown): AskRequest | undefined {
  if (!body || typeof body !== "object" || !Array.isArray((body as { files?: unknown }).files)) return undefined;
  const raw = (body as { files: unknown[] }).files;
  if (raw.length === 0 || raw.length > MAX_PHOTOS_AT_ONCE) return undefined;
  const files: AskFile[] = [];
  for (const each of raw) {
    if (!each || typeof each !== "object") return undefined;
    const { name, size, type, durationMs } = each as Record<string, unknown>;
    if (typeof name !== "string" || typeof type !== "string" || typeof size !== "number" || !Number.isInteger(size) || size < 0) return undefined;
    files.push({ name: name.slice(0, NAME_MAX), size, type, durationMs: typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined });
  }
  return { files };
}

// Why an ask is refused as a whole; `left` is how many places the album has, `limit` the bytes a
// storage refusal names (album/album.ts, Room). A file refused for its size or length carries the
// cap applied (`max`, bytes or milliseconds), which may be lower than the page knew.
export type AlbumRefusal = "tooFast" | "closed" | "notAllowed" | "tooMany" | "albumFull" | "albumStorageFull" | "siteFull" | "diskFull" | "failed";

export type AskResponse =
  | { uploads: ({ ok: true; id: string; name: string; partSize: number; kind: PhotoKind } | { ok: false; name: string; problem: UploadProblem; max?: number })[] }
  | { error: AlbumRefusal; left?: number; limit?: number };

export type PartResponse = { received: number[] };

export type FinishResponse = { ok: true; item: { id: string; kind: PhotoKind; state: "ready" | "pending" | "processing" } } | { ok: false; problem: UploadProblem };

// The parts still to send on a resume (ticket 07), in order.
export function missingParts(received: number[], parts: number): number[] {
  const have = new Set(received);
  return Array.from({ length: parts }, (_, part) => part).filter((part) => !have.has(part));
}
