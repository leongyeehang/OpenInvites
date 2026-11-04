"use server";

import { revalidatePath } from "next/cache";
import { findEventBySlug } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { isUuid } from "@/lib/uuid";
import { mayDeletePhoto } from "./album";
import { deletePhoto, findPhoto } from "./repository";
import { albumViewer } from "./viewer";

// Deleting a photo from the album (M4 ticket 11): a host any, a guest their own. Not counted against
// the upload limit, which is for what is held in memory and stored: a delete only takes away what
// its viewer may. One this viewer may not delete is left as it is, as one that does not exist is.
export async function deletePhotoAction(slug: string, id: string): Promise<void> {
  const event = await findEventBySlug(slug);
  if (!event || !isUuid(id)) return;
  const [viewer, found] = await Promise.all([albumViewer(event.id), findPhoto(event.id, id)]);
  if (!found || !mayDeletePhoto(viewer, found)) return;
  await deletePhoto(event.id, found.id);
  for (const path of eventPaths(event)) revalidatePath(path);
}
