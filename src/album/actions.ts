"use server";

import { revalidatePath } from "next/cache";
import { findEventBySlug } from "@/events/repository";
import { featureOn, siteFeatures } from "@/features";
import { gateFor } from "@/invites/gate";
import { eventPaths } from "@/events/slug";
import { isUuid } from "@/lib/uuid";
import { mayApprovePhoto, mayDeletePhoto } from "./album";
import { approvePhoto, deletePhoto, findPhoto } from "./repository";
import { albumViewer } from "./viewer";

// Both open the event only to whom its page opens (invites/gate.ts): on an invite-only event, its
// hosts and the devices that are in. Neither acts while the operator has the Album switched off
// (M8 ticket 01).

// Deleting a photo from the album (M4 ticket 11): a host any, a guest their own. Not counted against
// the upload limit, which is for what is held in memory and stored: a delete only takes away what
// its viewer may. One this viewer may not delete is left as it is, as one that does not exist is.
export async function deletePhotoAction(slug: string, id: string): Promise<void> {
  if (!featureOn(await siteFeatures(), "album")) return;
  const event = await findEventBySlug(slug);
  if (!event || !isUuid(id) || (await gateFor(event)).page !== "invitation") return;
  const [viewer, found] = await Promise.all([albumViewer(event.id), findPhoto(event.id, id)]);
  if (!found || !mayDeletePhoto(viewer, found)) return;
  await deletePhoto(event.id, found.id);
  for (const path of eventPaths(event)) revalidatePath(path);
}

// Approving a photo that waits for it (M6 ticket 03): a host's alone, co-hosts included. One this
// viewer may not approve, or that does not wait, is left as it is, as one that does not exist is.
export async function approvePhotoAction(slug: string, id: string): Promise<void> {
  if (!featureOn(await siteFeatures(), "album")) return;
  const event = await findEventBySlug(slug);
  if (!event || !isUuid(id) || (await gateFor(event)).page !== "invitation") return;
  const [viewer, found] = await Promise.all([albumViewer(event.id), findPhoto(event.id, id)]);
  if (!found || !mayApprovePhoto(viewer)) return;
  if (!(await approvePhoto(event.id, found.id))) return;
  for (const path of eventPaths(event)) revalidatePath(path);
}
