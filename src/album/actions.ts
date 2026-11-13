"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { findEventBySlug } from "@/events/repository";
import { featureOn, siteFeatures } from "@/features";
import { gateFor } from "@/invites/gate";
import { eventPaths } from "@/events/slug";
import { isUuid } from "@/lib/uuid";
import { consume } from "@/rate-limit/rate-limit";
import { albumSwitchedOn, mayApprovePhoto, mayCaption, mayDeletePhoto, parseCaption } from "./album";
import { approvePhoto, deletePhoto, findPhoto, setCaption } from "./repository";
import { albumViewer } from "./viewer";

// Each opens the event only to whom its page opens (invites/gate.ts): on an invite-only event, its
// hosts and the devices that are in. None acts while the album is switched off, by the operator
// for the site (M8 ticket 01) or by the host for the event (M8 ticket 25; album.ts, albumSwitchedOn).

// Deleting a photo from the album (M4 ticket 11): a host any, a guest their own. Not counted against
// the upload limit, which is for what is held in memory and stored: a delete only takes away what
// its viewer may. One this viewer may not delete is left as it is, as one that does not exist is.
export async function deletePhotoAction(slug: string, id: string): Promise<void> {
  const event = await findEventBySlug(slug);
  if (!event || !albumSwitchedOn(event, featureOn(await siteFeatures(), "album"))) return;
  if (!isUuid(id) || (await gateFor(event)).page !== "invitation") return;
  const [viewer, found] = await Promise.all([albumViewer(event.id), findPhoto(event.id, id)]);
  if (!found || !mayDeletePhoto(viewer, found)) return;
  await deletePhoto(event.id, found.id);
  for (const path of eventPaths(event)) revalidatePath(path);
}

// Approving a photo that waits for it (M6 ticket 03): a host's alone, co-hosts included. One this
// viewer may not approve, or that does not wait, is left as it is, as one that does not exist is.
export async function approvePhotoAction(slug: string, id: string): Promise<void> {
  const event = await findEventBySlug(slug);
  if (!event || !albumSwitchedOn(event, featureOn(await siteFeatures(), "album"))) return;
  if (!isUuid(id) || (await gateFor(event)).page !== "invitation") return;
  const [viewer, found] = await Promise.all([albumViewer(event.id), findPhoto(event.id, id)]);
  if (!found || !mayApprovePhoto(viewer)) return;
  if (!(await approvePhoto(event.id, found.id))) return;
  for (const path of eventPaths(event)) revalidatePath(path);
}

// Writing, changing or removing an item's caption (M8 ticket 09): its uploader's or a host's. Every
// save counts against the comment limit before anything is looked up, as a comment does. An event
// whose page is not open to this viewer, an album switched off, an item gone or one this viewer may
// not caption are all closed; the caption is cleaned and measured as parseCaption says.
export async function setCaptionAction(slug: string, photoId: string, caption: string): Promise<{ error?: "tooFast" | "captionTooLong" | "closed" }> {
  if (!(await consume("comment", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event || !isUuid(photoId) || (await gateFor(event)).page !== "invitation" || !albumSwitchedOn(event, featureOn(await siteFeatures(), "album"))) return { error: "closed" };
  const [viewer, found] = await Promise.all([albumViewer(event.id), findPhoto(event.id, photoId)]);
  if (!found || !mayCaption(viewer, found)) return { error: "closed" };
  const parsed = parseCaption(typeof caption === "string" ? caption : "");
  if (!parsed.ok) return { error: parsed.error };
  if (!(await setCaption(event.id, found.id, parsed.caption))) return { error: "closed" };
  for (const path of eventPaths(event)) revalidatePath(path);
  return {};
}
