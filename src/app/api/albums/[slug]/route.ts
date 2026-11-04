import { albumState, MAX_PHOTOS_AT_ONCE, mayUseAlbum, photosRoom } from "@/album/album";
import { processPhoto, removePhotoFiles, storePhoto } from "@/album/files";
import { addPhotos, countPhotos } from "@/album/repository";
import { albumViewer } from "@/album/viewer";
import { findEventBySlug } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { baseUrl, maxUploadBytes } from "@/instance/env";
import { instanceLimits } from "@/instance/repository";
import { consume, retryAfter } from "@/rate-limit/rate-limit";
import { newUploadId } from "@/uploads/repository";
import type { UploadProblem } from "@/uploads/validate";
import { revalidatePath } from "next/cache";

// What became of each photo sent, in the order sent, or why none was taken.
export type AlbumRefusal = "tooFast" | "closed" | "notAllowed" | "tooMany" | "albumFull" | "tooLarge";
export type AlbumUploadResult = { results?: ({ ok: true } | { ok: false; problem: UploadProblem })[]; error?: AlbumRefusal; left?: number };

// Adding photos to an event's album (M4 ticket 11): up to ten in one post, as multipart "photos",
// each through the photo pipeline (album/files.ts) under the operator's MAX_UPLOAD_MB. One post
// counts once against the upload limit. A route handler, as the poster's upload is, so the body is
// read up to the limit the operator set when the app started, and no further.
export async function POST(request: Request, context: RouteContext<"/api/albums/[slug]">) {
  // Only the instance's own pages may send one: the cookies would otherwise ride along from anywhere.
  if (request.headers.get("origin") !== new URL(baseUrl()).origin) return new Response(null, { status: 403 });
  const verdict = await consume("upload", request.headers);
  if (!verdict.allowed) return refused("tooFast", 429, retryAfter(verdict));
  const { slug } = await context.params;
  const event = await findEventBySlug(slug);
  if (!event || albumState(event, new Date()) !== "open") return refused("closed", 409);
  const viewer = await albumViewer(event.id);
  if (!mayUseAlbum(viewer) || viewer.kind === "visitor") return refused("notAllowed", 403);

  const maxBytes = maxUploadBytes();
  // Ten photos at the most, each at the most the operator allows, and room for the form's framing.
  const body = await readUpTo(request, MAX_PHOTOS_AT_ONCE * maxBytes + 1024 * 1024);
  if (!body) return refused("tooLarge", 413);
  let files: File[];
  try {
    const form = await new Response(new Uint8Array(body), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
    files = form.getAll("photos").filter((each): each is File => each instanceof File);
  } catch {
    return refused("tooLarge", 400);
  }
  const { maxPhotosPerEvent } = await instanceLimits();
  const room = photosRoom(await countPhotos(event.id), files.length, maxPhotosPerEvent);
  if (!room.ok) return Response.json({ error: room.error, left: room.left } satisfies AlbumUploadResult, { status: 409 });

  // Each is processed and stored before the rows that name them, so no page asks for a file not there.
  const results: NonNullable<AlbumUploadResult["results"]> = [];
  const stored: { id: string; width: number; height: number }[] = [];
  for (const file of files) {
    const processed = await processPhoto(new Uint8Array(await file.arrayBuffer()), maxBytes);
    if (!processed.ok) {
      results.push({ ok: false, problem: processed.problem });
      continue;
    }
    const id = await newUploadId();
    await storePhoto(id, processed.photo.files);
    stored.push({ id, width: processed.photo.width, height: processed.photo.height });
    results.push({ ok: true });
  }
  if (stored.length > 0) {
    const owner = viewer.kind === "host" ? { hostId: viewer.hostId } : { rsvpId: viewer.rsvpId };
    const added = await addPhotos(event.id, owner, stored, maxPhotosPerEvent);
    if (added !== "added") {
      await removePhotoFiles(stored.map((each) => each.id));
      return Response.json({ error: "albumFull", left: added.full } satisfies AlbumUploadResult, { status: 409 });
    }
    for (const path of eventPaths(event)) revalidatePath(path);
  }
  return Response.json({ results } satisfies AlbumUploadResult);
}

function refused(error: AlbumRefusal, status: number, headers?: HeadersInit) {
  return Response.json({ error } satisfies AlbumUploadResult, { status, headers });
}

// The request's body, or undefined as soon as it runs past `limit` (as the poster's upload reads it).
async function readUpTo(request: Request, limit: number): Promise<Uint8Array | undefined> {
  if (Number(request.headers.get("content-length")) > limit) return undefined;
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read = await reader?.read(); read && !read.done; read = await reader!.read()) {
    size += read.value.byteLength;
    if (size > limit) {
      await reader!.cancel();
      return undefined;
    }
    chunks.push(read.value);
  }
  return Buffer.concat(chunks);
}
