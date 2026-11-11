import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { albumAccess, owns, UPLOAD_ID, type Adder, type AlbumEvent } from "@/album/access";
import { findUpload, markPartReceived, type AlbumUpload } from "@/album/repository";
import { uploadDir } from "@/album/tmp";
import { partPlan, type PartResponse } from "@/album/upload-protocol";

// One part of an upload (M7 ticket 06): PUT with the part's bytes, GET to learn which parts have
// arrived, for a resume after a dropped connection. The parts are kept on this container's disk
// until the finish assembles them.

export type Located = { ok: true; event: AlbumEvent; viewer: Adder; upload: AlbumUpload } | { ok: false; response: Response };

export async function locateUpload(request: Request, slug: string, id: string): Promise<Located> {
  const access = await albumAccess(request, slug);
  if (!access.ok) return access;
  if (!UPLOAD_ID.test(id)) return { ok: false, response: new Response(null, { status: 404 }) };
  const upload = await findUpload(access.event.id, id);
  if (!upload) return { ok: false, response: new Response(null, { status: 404 }) };
  if (!owns(access.viewer, upload)) return { ok: false, response: new Response(null, { status: 403 }) };
  return { ok: true, event: access.event, viewer: access.viewer, upload };
}

export async function GET(request: Request, context: RouteContext<"/api/albums/[slug]/uploads/[upload]">) {
  const { slug, upload: id } = await context.params;
  const located = await locateUpload(request, slug, id);
  if (!located.ok) return located.response;
  return Response.json({ received: located.upload.received } satisfies PartResponse);
}

export async function PUT(request: Request, context: RouteContext<"/api/albums/[slug]/uploads/[upload]">) {
  const { slug, upload: id } = await context.params;
  const located = await locateUpload(request, slug, id);
  if (!located.ok) return located.response;
  const { upload } = located;
  const part = Number(new URL(request.url).searchParams.get("part"));
  const parts = partPlan(upload.size, upload.partSize);
  if (!Number.isInteger(part) || part < 0 || part >= parts) return new Response(null, { status: 400 });
  // The last part holds what is left; a part carries exactly its share: more is refused as too
  // large, less (a body that ended early) as a bad request, and neither is counted as received,
  // so a resume never skips a part that is not whole.
  const share = part === parts - 1 ? upload.size - part * upload.partSize : upload.partSize;
  const path = join(await uploadDir(upload.id), String(part));
  const written = await writeUpTo(request, path, share);
  if (written !== share) {
    await rm(path, { force: true });
    return new Response(null, { status: written === undefined ? 413 : 400 });
  }
  return Response.json({ received: await markPartReceived(upload.id, part) } satisfies PartResponse);
}

// The request's body into the file, chunk by chunk, or undefined as soon as it runs past `limit`
// (the shape the poster's upload reads with, kept out of memory here).
async function writeUpTo(request: Request, path: string, limit: number): Promise<number | undefined> {
  if (Number(request.headers.get("content-length")) > limit) return undefined;
  const reader = request.body?.getReader();
  const out = createWriteStream(path);
  let size = 0;
  try {
    for (let read = await reader?.read(); read && !read.done; read = await reader!.read()) {
      size += read.value.byteLength;
      if (size > limit) {
        await reader!.cancel();
        return undefined;
      }
      await new Promise<void>((resolve, reject) => out.write(read.value, (error) => (error ? reject(error) : resolve())));
    }
  } finally {
    await new Promise<void>((resolve) => out.end(resolve));
  }
  return size;
}
