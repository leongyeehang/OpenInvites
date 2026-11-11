import { and, count, eq, inArray, notExists } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, photo, videoJob } from "@/db/schema";
import { videoFourKCopy } from "@/instance/repository";
import { chunks } from "@/lib/chunks";
import { missingSizes, probeOfItem, withFourK, type VideoQuality } from "./video";

// Make missing sizes, on the Storage card (M8 ticket 04; spec, "Make missing sizes"): the ready
// videos that lack a size their event asks for now, with the operator's 4K copy when its switch is
// on, so that videos added before 0.8, or before an event's sizes changed, get them without
// leaving their albums. An item with a job already queued is left to that job. The count is read
// whenever Site settings is drawn, and is one pass over the site's videos.
export async function videosMissingSizes(): Promise<{ id: string; missing: VideoQuality[] }[]> {
  const [rows, fourK] = await Promise.all([
    getDb()
      .select({ id: photo.id, codec: photo.codec, width: photo.width, height: photo.height, bytes: photo.bytes, durationMs: photo.durationMs, copies: photo.copies, sizes: event.albumCopySizes })
      .from(photo)
      .innerJoin(event, eq(event.id, photo.eventId))
      .where(and(eq(photo.kind, "video"), inArray(photo.status, ["approved", "pending"]), notExists(getDb().select({ id: videoJob.id }).from(videoJob).where(eq(videoJob.photoId, photo.id))))),
    videoFourKCopy(),
  ]);
  return rows.flatMap((item) => {
    const probe = probeOfItem(item);
    const missing = probe ? missingSizes(item, withFourK(probe, item.sizes, fourK)) : [];
    return missing.length > 0 ? [{ id: item.id, missing }] : [];
  });
}

// How many videos have a `sizes` job, queued or under way, for the Storage card's line of its own
// (media part review): until they are done, not every video has its sizes, though none is counted
// as lacking one.
export async function videosHavingSizesMade(): Promise<number> {
  const [row] = await getDb().select({ count: count() }).from(videoJob).where(eq(videoJob.work, "sizes"));
  return row?.count ?? 0;
}

// Each of those queued as a `sizes` job, behind every new upload (jobs.ts), and how many went in;
// one that gained a job meanwhile keeps it. The items stay ready, and nothing is deleted, whatever
// the event no longer asks for.
export async function queueMissingSizes(): Promise<number> {
  const items = await videosMissingSizes();
  let queued = 0;
  for (const run of chunks(items, 1000)) {
    const added = await getDb()
      .insert(videoJob)
      .values(run.map(({ id }) => ({ photoId: id, work: "sizes" as const })))
      .onConflictDoNothing({ target: videoJob.photoId })
      .returning({ id: videoJob.id });
    queued += added.length;
  }
  return queued;
}
