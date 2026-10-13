import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { queueDueReminders } from "@/reminders/queue";
import { sweepRetention } from "@/retention/sweep";
import { deleteStaleEmailCodes } from "@/rsvps/repository";
import { isMailConfigured } from "./config";
import { sendDue } from "./outbox";

const EVERY_MINUTE = 60_000;
const EVERY_HOUR = 60 * EVERY_MINUTE;

// The instrumentation hook that starts the worker and the actions that kick it are bundled apart
// but run in one process, so the worker's state hangs off the process's global object rather than
// off a module (as the rate limits' does): the minute's run and a kick see the same flag. A run
// asked for while one is going sets `again`, and the going one runs once more before it stops.
// `sweptAt` is when this container last began a retention sweep.
const SHARED = Symbol.for("openinvites.mailWorker");

type Worker = { timer?: NodeJS.Timeout; running: boolean; again: boolean; sweptAt?: number };

function worker(): Worker {
  const global = globalThis as { [SHARED]?: Worker };
  global[SHARED] ??= { running: false, again: false };
  return global[SHARED];
}

// The instance's one clock (spec, "Architecture"), started from register() in instrumentation.ts
// once the start checks have passed, with or without mail; not under `next build`. Every minute it
// sweeps for retention when this container has not swept in the last hour, or not since it
// started, so the first minute after a start sweeps; then, with mail, it queues the reminders that
// are due and sends the outbox, the warnings the sweep has just queued among them. Without mail
// nothing is ever queued, so there are no reminders and no outbox to send.
export function startMailWorker(): void {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  worker().timer ??= setInterval(() => void tick(), EVERY_MINUTE);
}

async function tick(): Promise<void> {
  await sweepWhenDue(new Date());
  if (isMailConfigured()) await kickMailWorker();
}

// The hour runs from when a sweep begins, so one that runs long or fails is not begun again before
// the hour is up. A failure is logged; the events it missed are found by the next sweep.
async function sweepWhenDue(now: Date): Promise<void> {
  const state = worker();
  if (state.sweptAt !== undefined && now.getTime() - state.sweptAt < EVERY_HOUR) return;
  state.sweptAt = now.getTime();
  try {
    await sweepRetention(now);
  } catch (error) {
    console.error("Retention: the sweep failed:", error);
  }
}

// Sends whatever is due now rather than at the next minute, after queuing the reminders due now
// (spec, "Mail outbox and worker"). An action that has just queued mail calls it through after(),
// so that its response does not wait for the mail server. The outbox is read with a clock taken
// after the reminders are queued, so they go out in this run. Each run also deletes the codes
// guests were sent to prove their email once they are a day old (rsvps/verification.ts): codes
// exist only with mail, and this runs only with mail, from the clock's minute or after mail was
// queued.
export async function kickMailWorker(): Promise<void> {
  const state = worker();
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  try {
    await deleteStaleEmailCodes(new Date());
    do {
      state.again = false;
      await queueDueReminders(new Date());
      await sendDue(new Date());
    } while (state.again);
  } catch (error) {
    // The outbox keeps what was not sent, and the next minute's run tries again.
    console.error("Mail: sending queued mail failed:", error);
  } finally {
    state.running = false;
  }
}
