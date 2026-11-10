import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { hostname } from "node:os";
import { claimJob, failJob } from "./jobs";
import { processVideo } from "./processing";

// The processing queue's loop (M7 ticket 06): one clip at a time per container, taken under a
// lease (jobs.ts) and processed with ffmpeg (processing.ts). As the mail worker, its state hangs
// off the process's global object, since the instrumentation hook that starts it and the finish
// route that kicks it are bundled apart but run in one process: a kick while a run is going sets
// `again`, and the run goes round once more. A kick is never awaited by a request.

const SHARED = Symbol.for("openinvites.videoQueue");

type Queue = { timer?: NodeJS.Timeout; running: boolean; again: boolean };

function queue(): Queue {
  const global = globalThis as { [SHARED]?: Queue };
  global[SHARED] ??= { running: false, again: false };
  return global[SHARED];
}

const EVERY_MINUTE = 60_000;

// Started from register() in instrumentation.ts beside the mail worker; not under `next build`.
// Every minute it takes whatever waits, which also picks up a job whose lease a crash left.
export function startVideoQueue(): void {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  queue().timer ??= setInterval(() => void kickVideoQueue(), EVERY_MINUTE);
}

const me = () => `${hostname()}:${process.pid}`;

export async function kickVideoQueue(): Promise<void> {
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
