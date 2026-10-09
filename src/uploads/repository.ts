import { and, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { event, upload } from "@/db/schema";
import { hostedBy } from "@/hosts/repository";
import { applyChange } from "@/themes/changes";
import { parseTheme } from "@/themes/theme";
import type { Sample } from "./process";

export type Upload = typeof upload.$inferSelect;

// A fresh id from Postgres (ADR-0004), taken first so the files can be stored under it before
// the row that names them is written.
export async function newUploadId(): Promise<string> {
  const [row] = await getDb().execute<{ id: string }>(sql`select uuidv7() as id`);
  return row.id;
}

// The event's picture, for whoever is looking at the event: its page and its preview card.
// Cached per request, as the page asks and the host's drawer asks.
export const findEventUpload = cache(async (eventId: string): Promise<Upload | undefined> => {
  return getDb().query.upload.findFirst({ where: eq(upload.eventId, eventId) });
});

// The host's own events only, owned or co-hosted.
const hostEvent = (hostId: string, eventId: string) =>
  getDb().select({ id: event.id }).from(event).where(and(eq(event.id, eventId), hostedBy(hostId)));

// The id of the upload on one of the host's events, or null when it has none.
export async function findHostUploadId(hostId: string, eventId: string): Promise<string | null> {
  const [row] = await getDb().select({ id: upload.id }).from(upload).where(inArray(upload.eventId, hostEvent(hostId, eventId)));
  return row?.id ?? null;
}

// The new picture takes the old one's place and is shown, in one step: as the background, or as
// the poster when the host chose that for the old one (themes/changes.ts). The event is locked
// while it happens, so two uploads at once apply one after the other, and deleting the event
// meanwhile waits for it or finds it gone. The description does not carry over, as the new
// picture shows something else. Returns the id of the upload it replaced, whose files the
// caller removes, or undefined when the event is not the host's.
export async function replaceUpload(hostId: string, eventId: string, id: string, sample: Sample): Promise<{ replaced: string | null } | undefined> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ theme: event.theme })
      .from(event)
      .where(and(eq(event.id, eventId), hostedBy(hostId)))
      .for("update");
    if (!row) return undefined;
    const [old] = await tx.delete(upload).where(eq(upload.eventId, eventId)).returning({ id: upload.id });
    await tx.insert(upload).values({ id, eventId, ...sample });
    // A theme write moves updatedAt, which is what makes the link's preview card redraw.
    const theme = applyChange(parseTheme(row.theme), { knob: "uploadId", value: id });
    await tx.update(event).set({ theme, updatedAt: new Date() }).where(eq(event.id, eventId));
    return { replaced: old?.id ?? null };
  });
}

// The host's description of their picture. False when the event is not theirs or has no upload.
export async function describeUpload(hostId: string, eventId: string, altText: string): Promise<boolean> {
  const described = await getDb()
    .update(upload)
    .set({ altText })
    .where(inArray(upload.eventId, hostEvent(hostId, eventId)))
    .returning({ id: upload.id });
  return described.length > 0;
}

// A copy of another event's picture becomes this event's, with the same sample and description.
// The theme names it and is otherwise left as it is: unlike a new upload, it does not switch the
// event to the picture, since a duplicate wears the look the source did. False when the event is
// not the host's.
export async function attachUploadCopy(hostId: string, eventId: string, id: string, from: Upload): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ theme: event.theme })
      .from(event)
      .where(and(eq(event.id, eventId), hostedBy(hostId)))
      .for("update");
    if (!row) return false;
    const { altText, luminance, accent, lightest, darkest, posterLightest, posterDarkest, posterWidth, posterHeight } = from;
    await tx
      .insert(upload)
      .values({ id, eventId, altText, luminance, accent, lightest, darkest, posterLightest, posterDarkest, posterWidth, posterHeight });
    await tx
      .update(event)
      .set({ theme: { ...parseTheme(row.theme), uploadId: id }, updatedAt: new Date() })
      .where(eq(event.id, eventId));
    return true;
  });
}
