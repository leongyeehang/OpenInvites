import { getStorage } from "@/storage/storage";
import { RENDITION_NAMES, renditionKey, type RenditionName } from "./renditions";

// An upload's files, through the storage interface (ADR-0003).

export async function storeRenditions(id: string, renditions: Record<RenditionName, Uint8Array>): Promise<void> {
  await Promise.all(RENDITION_NAMES.map((name) => getStorage().put(renditionKey(id, name), renditions[name])));
}

export function readRendition(id: string, name: RenditionName): Promise<Uint8Array | undefined> {
  return getStorage().get(renditionKey(id, name));
}

// Removes uploads' files once nothing names them any more. A file that will not go is left
// where no page can reach it, and logged for the operator, rather than undoing what the host
// asked for.
export async function removeRenditions(ids: string[]): Promise<void> {
  const removals = ids.flatMap((id) => RENDITION_NAMES.map((name) => getStorage().delete(renditionKey(id, name))));
  for (const removal of await Promise.allSettled(removals)) {
    if (removal.status === "rejected") console.error("An uploaded file could not be removed:", removal.reason);
  }
}
