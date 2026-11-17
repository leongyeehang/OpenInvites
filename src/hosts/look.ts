import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { hostLook } from "@/db/schema";
import { storedPick } from "@/instance/site-look";
import type { GalleryPosterId } from "@/themes/posters";

// The poster a host picked in Account's Backdrop card (M8 ticket 22), or null for Automatic: no row,
// a null poster, or a poster that has since left the gallery (storedPick). Cached per request, as
// the frame and the Account page both ask.
export const findHostLook = cache(async (hostId: string): Promise<GalleryPosterId | null> => {
  const [row] = await getDb().select({ poster: hostLook.poster }).from(hostLook).where(eq(hostLook.hostId, hostId));
  return storedPick(row?.poster ?? null);
});

// Saves the host's choice, Automatic as null, over the one they saved before.
export async function setHostLook(hostId: string, poster: GalleryPosterId | null): Promise<void> {
  await getDb()
    .insert(hostLook)
    .values({ hostId, poster })
    .onConflictDoUpdate({ target: hostLook.hostId, set: { poster, updatedAt: new Date() } });
}
