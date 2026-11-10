import { PHOTO_FILES, photoFileNamed, photoKey } from "@/album/files";
import { isUuid } from "@/lib/uuid";
import { parseRange } from "@/storage/range";
import { getStorage } from "@/storage/storage";
import { RENDITIONS, renditionKey, renditionNamed } from "@/uploads/renditions";

// A host's picture, as the page asks for it (uploads/renditions.ts), or an album photo's file
// (album/files.ts). Served by the application from the storage interface whichever backend holds
// it, so an S3 bucket can stay private. Every upload has a new id, so what is behind a URL never
// changes and may be kept for a year; once the picture is replaced or its event deleted, the URL
// is not found. Since M7 (ticket 04) the file is streamed, never read whole, and a Range header
// is answered with 206, which is how a browser's player seeks in a video.

type Served = { key: string; type: string; size: number };

// What a file name under an id is, and where it is kept; ticket 05 adds a video's files.
function fileNamed(id: string, file: string): { key: string; type: string } | undefined {
  const rendition = renditionNamed(file);
  if (rendition) return { key: renditionKey(id, rendition), type: RENDITIONS[rendition].type };
  const photo = photoFileNamed(file);
  if (photo) return { key: photoKey(id, photo), type: PHOTO_FILES[photo].type };
  return undefined;
}

async function locate(id: string, file: string): Promise<Served | undefined> {
  if (!isUuid(id)) return undefined;
  const named = fileNamed(id, file);
  if (!named) return undefined;
  const found = await getStorage().stat(named.key);
  return found && { ...named, size: found.size };
}

const headers = (served: Served, more: Record<string, string> = {}) => ({
  "Content-Type": served.type,
  "Accept-Ranges": "bytes",
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
  ...more,
});

export async function GET(request: Request, context: RouteContext<"/uploads/[id]/[file]">) {
  const { id, file } = await context.params;
  const served = await locate(id, file);
  if (!served) return new Response(null, { status: 404 });
  const range = parseRange(request.headers.get("range"), served.size);
  if (range === "unsatisfiable") return new Response(null, { status: 416, headers: headers(served, { "Content-Range": `bytes */${served.size}` }) });
  const body = await getStorage().stream(served.key, range);
  if (!body) return new Response(null, { status: 404 });
  if (range) {
    return new Response(body, { status: 206, headers: headers(served, { "Content-Range": `bytes ${range.start}-${range.end}/${served.size}`, "Content-Length": String(range.end - range.start + 1) }) });
  }
  return new Response(body, { status: 200, headers: headers(served, { "Content-Length": String(served.size) }) });
}

// Next would otherwise answer HEAD by running GET, which opens a stream for nothing.
export async function HEAD(_request: Request, context: RouteContext<"/uploads/[id]/[file]">) {
  const { id, file } = await context.params;
  const served = await locate(id, file);
  if (!served) return new Response(null, { status: 404 });
  return new Response(null, { status: 200, headers: headers(served, { "Content-Length": String(served.size) }) });
}
