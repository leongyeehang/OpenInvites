import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { event, photo, videoJob } from "@/db/schema";
import type { VideoQuality, VideoWork } from "./video";
import { photoStatusForOwner, type PhotoStatus } from "./visibility";

// The processing queue (M7 ticket 06): one `video_job` row per video from its upload until ffmpeg
// is done with it. A job is taken under a committed lease, never inside a transaction held across
// ffmpeg, which runs for minutes and would pin a pooled connection; a lease an hour old is a
// crashed processor's and is taken again. Three tries in all, then the item is failed.
//
// A job is first a `process` job, which makes a clip into a ready item. When the item's event asks
// for sizes it still lacks, the job does not go but becomes a `sizes` job (M8 ticket 03): each
// claim makes one missing copy from the stored original and gives the job back behind everything
// else waiting, so a new upload never waits behind another item's encodes. A `sizes` job carries
// no list; each claim works out what the item lacks at that moment. It is never failed: a size
// that cannot be made drops the job, and the item stays ready.

export const LEASE_MS = 60 * 60 * 1000;
export const MAX_TRIES = 3;

export function claimable(job: { leasedAt: Date | null }, now: Date): boolean {
  return job.leasedAt === null || now.getTime() - job.leasedAt.getTime() >= LEASE_MS;
}

export function exhausted(job: { attempts: number }): boolean {
  return job.attempts >= MAX_TRIES;
}

// A claim counts a try. A job claimed more times than there are tries was never given back by a
// try that ended (failJob gives it back): the processor died on it each time, as a clip that
// takes more memory than the container has would see to, and it is failed rather than taken again
// every hour for ever.
export function crashedOut(job: { attempts: number }): boolean {
  return job.attempts > MAX_TRIES;
}

export type ClaimedJob = { id: string; photoId: string; attempts: number; work: VideoWork };

// One statement: the oldest claimable job, `process` jobs before `sizes` ones, locked and skipped
// if another container holds it, leased to `me` with its tries counted. Nothing when the queue is
// empty. The times go as ISO strings: a raw statement's Date parameters reach the driver
// unserialised.
export async function claimJob(me: string, now: Date): Promise<ClaimedJob | undefined> {
  const lapsed = new Date(now.getTime() - LEASE_MS).toISOString();
  const rows = await getDb().execute<{ id: string; photo_id: string; attempts: number; work: VideoWork }>(sql`
    update video_job set leased_at = ${now.toISOString()}::timestamptz, leased_by = ${me}, attempts = attempts + 1
    where id = (select id from video_job where leased_at is null or leased_at < ${lapsed}::timestamptz order by (work = 'sizes'), created_at limit 1 for update skip locked)
    returning id, photo_id, attempts, work`);
  const row = rows[0];
  return row && { id: row.id, photoId: row.photo_id, attempts: row.attempts, work: row.work };
}

// What processing learned of a video, and the sizes it stored copies at, largest first (M8 ticket 02).
export type Processed = { width: number; height: number; durationMs: number; codec: string; copies: VideoQuality[] };

// The item becomes what a photo added now would be, pending for a guest while the host approves
// items and approved otherwise, decided under the event's lock as addPhotos decides it; only an
// item still processing is finished, so one deleted meanwhile (plan ruling 20) is left alone and
// the caller removes what it stored. The job goes, or, when there are `more` sizes to make, becomes
// the item's `sizes` job, untried and behind every job already waiting.
export async function completeJob(photoId: string, result: Processed, more: boolean): Promise<{ status: PhotoStatus; eventId: string } | undefined> {
  return getDb().transaction(async (tx) => {
    const [item] = await tx
      .select({ eventId: photo.eventId, hostId: photo.hostId })
      .from(photo)
      .where(and(eq(photo.id, photoId), eq(photo.status, "processing")));
    if (!item) {
      await tx.delete(videoJob).where(eq(videoJob.photoId, photoId));
      return undefined;
    }
    const [locked] = await tx.select({ albumApprovalRequired: event.albumApprovalRequired }).from(event).where(eq(event.id, item.eventId)).for("no key update");
    const status = photoStatusForOwner(locked, item.hostId ? "host" : "guest");
    const updated = await tx
      .update(photo)
      .set({ status, ...result })
      .where(and(eq(photo.id, photoId), eq(photo.status, "processing")))
      .returning({ id: photo.id });
    if (more && updated.length > 0) await tx.update(videoJob).set({ work: "sizes", leasedAt: null, leasedBy: null, lastError: null, attempts: 0, createdAt: sql`now()` }).where(eq(videoJob.photoId, photoId));
    else await tx.delete(videoJob).where(eq(videoJob.photoId, photoId));
    return updated.length > 0 ? { status, eventId: item.eventId } : undefined;
  });
}

// A try that did not end well: the lease is given up with the reason kept for the operator's
// logs, or, on the last try or for a failure no retry would mend (`final`), the item is failed
// with the reason on it, for its tile, and the job goes.
export async function failJob(job: ClaimedJob, reason: string, final = false): Promise<"retry" | "failed"> {
  if (final || exhausted(job)) {
    await getDb().transaction(async (tx) => {
      await tx.update(photo).set({ status: "failed", failure: reason.slice(0, 200) }).where(and(eq(photo.id, job.photoId), eq(photo.status, "processing")));
      await tx.delete(videoJob).where(eq(videoJob.id, job.id));
    });
    return "failed";
  }
  await getDb().update(videoJob).set({ leasedAt: null, leasedBy: null, lastError: reason.slice(0, 1000) }).where(eq(videoJob.id, job.id));
  return "retry";
}

// A `sizes` job that is done, or that failed: it goes, and the item stays as it is.
export async function dropJob(job: ClaimedJob): Promise<void> {
  await getDb().delete(videoJob).where(eq(videoJob.id, job.id));
}

// A `sizes` job with more to make after this claim's copy: given back behind every job waiting,
// so other items' sizes, and every new upload, take their turn first.
export async function releaseJob(job: ClaimedJob): Promise<void> {
  await getDb().update(videoJob).set({ leasedAt: null, leasedBy: null, attempts: 0, createdAt: sql`now()` }).where(eq(videoJob.id, job.id));
}
