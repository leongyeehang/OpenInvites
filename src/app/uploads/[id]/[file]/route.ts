import { isUuid } from "@/lib/uuid";
import { readRendition } from "@/uploads/files";
import { RENDITIONS, renditionNamed } from "@/uploads/renditions";

// A host's picture, as the page asks for it (uploads/renditions.ts). Served by the application
// from the storage interface whichever backend holds it, so an S3 bucket can stay private. Every
// upload has a new id, so what is behind a URL never changes and may be kept for a year; once the
// picture is replaced or its event deleted, the URL is not found.
export async function GET(_request: Request, context: RouteContext<"/uploads/[id]/[file]">) {
  const { id, file } = await context.params;
  const name = renditionNamed(file);
  const body = name && isUuid(id) ? await readRendition(id, name) : undefined;
  if (!name || !body) return new Response(null, { status: 404 });
  // As a plain ArrayBuffer's bytes, which is what a response body takes.
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": RENDITIONS[name].type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
