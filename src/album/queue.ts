import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { hostname } from "node:os";
import { processesVideosHere, videoRole } from "@/instance/env";
import { markVideoWorkerSeen } from "@/instance/repository";
import { getStorage } from "@/storage/storage";
import { claimJob, crashedOut, dropJob, failJob, type ClaimedJob } from "./jobs";
import { processSizes, processVideo } from "./processing";
import { sentKey } from "./video";

// The processing queue's loop (M7 ticket 06): one clip at a time per container, taken under a
// lease (jobs.ts) and processed with ffmpeg (processing.ts). As the mail worker, its state hangs
// off the process's global object, since the instrumentation hook that starts it and the finish
// route that kicks it are bundled apart but run in one process: a kick while a run is going sets
// `again`, and the run goes round once more. A kick is never awaited by a request. A claimed job
// processes a clip or makes one of a ready item's sizes, by its work (M8 ticket 03).

const SHARED = Symbol.for("openinvites.videoQueue");

type Queue = { timer?: NodeJS.Timeout; running: boolean; again: boolean };

function queue(): Queue {
  const global = globalThis as { [SHARED]?: Queue };
  global[SHARED] ??= { running: false, again: false };
  return global[SHARED];
}

const EVERY_MINUTE = 60_000;

// Started from register() in instrumentation.ts beside the mail worker; not under `next build`.
// Every minute it takes whatever waits, which also picks up a job whose lease a crash left. With
// the processing moved to a worker container (VIDEO_PROCESSING, ticket 08) the app starts nothing
// and a kick does nothing: the worker's minute goes round from its start, and it reports itself
// each time, which the Storage card shows.
export function startVideoQueue(): void {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD || !processesVideosHere()) return;
  const state = queue();
  if (state.timer) return;
  const worker = videoRole() === "worker";
  state.timer = setInterval(() => void tick(worker), EVERY_MINUTE);
  if (worker) void tick(worker);
}

async function tick(worker: boolean): Promise<void> {
  if (worker) await markVideoWorkerSeen(new Date()).catch((error) => console.error("Videos: the worker could not report itself:", error));
  await kickVideoQueue();
}

const me = () => `${hostname()}:${process.pid}`;

export async function kickVideoQueue(): Promise<void> {
  if (!processesVideosHere()) return;
  const state = queue();
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  try {
    do {
      state.again = false;
      for (let job = await claimJob(me(), new Date()); job; job = await claimJob(me(), new Date())) {
        if (job.work === "sizes") {
          await makeSize(job);
          continue;
        }
        // Claimed more times than there are tries: every try so far killed the processor.
        if (crashedOut(job)) {
          await failJob(job, "crashed", true);
          await getStorage().delete(sentKey(job.photoId)).catch((error) => console.error(`Videos: could not delete the clip as sent of failed item ${job.photoId}:`, error));
          console.error(`Videos: item ${job.photoId} was claimed ${job.attempts} times and never given back; the processor did not survive it, so it is failed.`);
          continue;
        }
        try {
          await processVideo(job);
        } catch (error) {
          const outcome = await failJob(job, error instanceof Error ? error.message : String(error));
          console.error(`Videos: processing item ${job.photoId} failed on try ${job.attempts} (${outcome}):`, error);
        }
      }
    } while (state.again);
  } catch (error) {
    console.error("Videos: the queue failed:", error);
  } finally {
    state.running = false;
  }
}

// A size that cannot be made, or one whose encode the processor did not survive, is dropped with
// its job and logged, never failed: the item stays ready with the sizes it has (M8 spec).
async function makeSize(job: ClaimedJob): Promise<void> {
  try {
    if (crashedOut(job)) throw new Error(`claimed ${job.attempts} times and never given back; the processor did not survive it`);
    await processSizes(job);
  } catch (error) {
    console.error(`Videos: making a size of item ${job.photoId} failed, so it was dropped:`, error);
    await dropJob(job);
  }
}
