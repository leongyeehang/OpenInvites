import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { isMailConfigured } from "./config";
import { sendDue } from "./outbox";

const EVERY_MINUTE = 60_000;

// The instrumentation hook that starts the worker and the actions that kick it are bundled apart
// but run in one process, so the worker's state hangs off the process's global object rather than
// off a module (as the rate limits' does): the minute's run and a kick see the same flag. A run
// asked for while one is going sets `again`, and the going one runs once more before it stops.
const SHARED = Symbol.for("openinvites.mailWorker");

type Worker = { timer?: NodeJS.Timeout; running: boolean; again: boolean };

function worker(): Worker {
  const global = globalThis as { [SHARED]?: Worker };
  global[SHARED] ??= { running: false, again: false };
  return global[SHARED];
}

// Sends the outbox every minute, from register() in instrumentation.ts once the start checks have
// passed. Without mail nothing is ever queued, so there is no worker; nor under `next build`.
export function startMailWorker(): void {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD || !isMailConfigured()) return;
  worker().timer ??= setInterval(() => void kickMailWorker(), EVERY_MINUTE);
}

// Sends whatever is due now rather than at the next minute. An action that has just queued mail
// calls it through after(), so that its response does not wait for the mail server.
export async function kickMailWorker(): Promise<void> {
  const state = worker();
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  try {
    do {
      state.again = false;
      await sendDue(new Date());
    } while (state.again);
  } catch (error) {
    // The outbox keeps what was not sent, and the next minute's run tries again.
    console.error("Mail: sending queued mail failed:", error);
  } finally {
    state.running = false;
  }
}
