import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { processPhoto, removeItemFiles, storePhoto } from "@/album/files";
import { notifyHostsOfItems } from "@/album/notify-hosts";
import { kickVideoQueue } from "@/album/queue";
import { deleteUpload, finishPhotoUpload, finishVideoUpload, pendingPhotosSince } from "@/album/repository";
import { removeDir, uploadDir } from "@/album/tmp";
import { partPlan, uploadComplete, type FinishResponse } from "@/album/upload-protocol";
import { sentKey } from "@/album/video";
import { photoStatusFor } from "@/album/visibility";
import { eventPaths } from "@/events/slug";
import { instanceLimits } from "@/instance/repository";
import { MEGABYTE } from "@/lib/sizes";
import { getStorage } from "@/storage/storage";
import { newUploadId } from "@/uploads/repository";
import type { UploadProblem } from "@/uploads/validate";
import { locateUpload } from "../route";

// The finish (M7 ticket 06): once every part is here and they add up to the size declared, a photo
// is processed and stored as the one post did, and becomes an item at once; a video is stored as
// sent, becomes an item in processing with a job in the queue, and the queue is kicked. The
// hosts are emailed once per batch about photos that wait, by the finish or the refusal of the
// batch's last photo, whichever comes last, so a file refused at its end does not lose the email.
export async function POST(request: Request, context: RouteContext<"/api/albums/[slug]/uploads/[upload]/finish">) {
  const { slug, upload: id } = await context.params;
  const located = await locateUpload(request, slug, id);
  if (!located.ok) return located.response;
  const { event, viewer, upload } = located;
  const parts = partPlan(upload.size, upload.partSize);
  const dir = await uploadDir(upload.id);
  const files = Array.from({ length: parts }, (_, part) => join(dir, String(part)));
  const sizes = await Promise.all(files.map(async (file) => (await stat(file).catch(() => undefined))?.size));
  if (!uploadComplete(upload.received, parts) || sizes.some((size) => size === undefined) || sizes.reduce((total, size) => total! + size!, 0) !== upload.size) {
    return problem("incomplete", 400);
  }

  if (upload.kind === "photo") {
    const tellHosts = async (lastPhotoOfBatch: boolean) => {
      if (!lastPhotoOfBatch || viewer.kind !== "guest") return;
      const photos = await pendingPhotosSince(upload);
      if (photos > 0) await notifyHostsOfItems(event, { name: viewer.name, photos, videos: 0 });
    };
    const bytes = Buffer.concat(await Promise.all(files.map((file) => readFile(file))));
    const processed = await processPhoto(bytes, (await instanceLimits()).maxPhotoMb * MEGABYTE);
    if (!processed.ok) {
      const { lastPhotoOfBatch } = await deleteUpload(upload);
      await removeDir(dir);
      await tellHosts(lastPhotoOfBatch);
      return problem(processed.problem, 422);
    }
    const itemId = await newUploadId();
    // Stored before the row that names them, so no page asks for a file not there.
    await storePhoto(itemId, processed.photo.files);
    const finished = await finishPhotoUpload(upload, { id: itemId, width: processed.photo.width, height: processed.photo.height }, (locked) => photoStatusFor(locked, viewer));
    await removeDir(dir);
    if (!finished) {
      await removeItemFiles([itemId]);
      return new Response(null, { status: 404 });
    }
    for (const path of eventPaths(event)) revalidatePath(path);
    await tellHosts(finished.lastPhotoOfBatch);
    return Response.json({ ok: true, item: { id: itemId, kind: "photo", state: finished.status === "pending" ? "pending" : "ready" } } satisfies FinishResponse);
  }

  const itemId = await newUploadId();
  const parts$ = Readable.from(
    (async function* () {
      for (const file of files) yield* createReadStream(file);
    })(),
  );
  await getStorage().putStream(sentKey(itemId), Readable.toWeb(parts$) as unknown as ReadableStream<Uint8Array>, upload.size);
  const made = await finishVideoUpload(upload, itemId);
  await removeDir(dir);
  if (!made) {
    await getStorage().delete(sentKey(itemId));
    return new Response(null, { status: 404 });
  }
  for (const path of eventPaths(event)) revalidatePath(path);
  // Never awaited: the queue runs for minutes, and the answer goes now.
  after(() => void kickVideoQueue());
  return Response.json({ ok: true, item: { id: itemId, kind: "video", state: "processing" } } satisfies FinishResponse);
}

function problem(problem: UploadProblem, status: number) {
  return Response.json({ ok: false, problem } satisfies FinishResponse, { status });
}
