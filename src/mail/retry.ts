// How long the outbox waits before trying a failed message again, in minutes: one for each of the
// first four failures (spec, "Mail outbox and worker").
const RETRY_MINUTES = [1, 5, 15, 60];

// When to try a message again, given how many times it has failed counting the failure just now,
// or null to give up on it: after the fifth failure.
export function nextAttempt(attempts: number, now: Date): Date | null {
  const minutes = RETRY_MINUTES[attempts - 1];
  return minutes === undefined ? null : new Date(now.getTime() + minutes * 60_000);
}
