import type { ThemeUpload } from "@/themes/resolve";
import { removeRenditions, storeRenditions } from "./files";
import { processUpload } from "./process";
import { renditionUrl } from "./renditions";
import { newUploadId, replaceUpload, type Upload } from "./repository";
import { uploadProblem, type UploadProblem } from "./validate";

export type UploadOutcome = { ok: true; id: string } | { ok: false; problem: UploadProblem | "notFound" };

// A host's picture for their event (spec, "Uploads and images"): checked by its content,
// processed into the sizes the page needs, stored, and shown as the event's background in place
// of any picture before it, whose files then go.
export async function uploadPicture(hostId: string, eventId: string, bytes: Uint8Array, maxBytes: number): Promise<UploadOutcome> {
  const problem = uploadProblem(bytes, maxBytes);
  if (problem) return { ok: false, problem };
  const processed = await processUpload(bytes);
  if (!processed.ok) return processed;

  const id = await newUploadId();
  try {
    // Stored before the row that names them, so no page ever asks for a file not yet there.
    await storeRenditions(id, processed.picture.renditions);
    const saved = await replaceUpload(hostId, eventId, id, processed.picture.sample);
    if (!saved) {
      await removeRenditions([id]);
      return { ok: false, problem: "notFound" };
    }
    if (saved.replaced) await removeRenditions([saved.replaced]);
    return { ok: true, id };
  } catch (error) {
    await removeRenditions([id]);
    throw error;
  }
}

// The upload as the theme and the page need it.
export function themeUpload({ id, accent, luminance, lightest, darkest, altText }: Upload): ThemeUpload {
  return { id, src: renditionUrl(id, "background"), accent, luminance, lightest, darkest, altText };
}
