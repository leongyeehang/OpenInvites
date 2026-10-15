import { RENDITION_NAMES, renditionKey } from "./renditions";
import { removeRenditions } from "./files";
import { attachUploadCopy, newUploadId, type Upload } from "./repository";
import { getStorage } from "@/storage/storage";

// A duplicate's own copy of the source's picture, under a new id so that deleting or replacing
// either event's picture never touches the other's files. The files are copied before the row that
// names them, as uploadPicture does, and go again if the row cannot be written.
export async function copyPicture(source: Upload, hostId: string, eventId: string): Promise<void> {
  const id = await newUploadId();
  try {
    await Promise.all(RENDITION_NAMES.map((name) => getStorage().copy(renditionKey(source.id, name), renditionKey(id, name))));
    if (!(await attachUploadCopy(hostId, eventId, id, source))) {
      await removeRenditions([id]);
      throw new Error("The event to attach the copied picture to is gone");
    }
  } catch (error) {
    await removeRenditions([id]);
    throw error;
  }
}
