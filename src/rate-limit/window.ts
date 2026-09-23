// How many requests a limit lets through, and over how long.
export type Rule = { limit: number; windowMs: number };

// One client's count against one limit: the window opens with its first request.
export type Window = { startedAt: number; count: number };

export type Outcome = { window: Window; allowed: boolean; retryAfterMs: number };

// A fixed window per client: it opens with the client's first request and lets `limit` requests
// through until it is over, then the next request opens a fresh one. A refused request is not
// counted and does not push the window back, so a client who keeps trying is let in again as
// soon as the window ends, and is told how long that is.
export function countRequest(current: Window | undefined, rule: Rule, now: number): Outcome {
  const window = current && !isOver(current, rule, now) ? current : { startedAt: now, count: 0 };
  if (window.count >= rule.limit) return { window, allowed: false, retryAfterMs: window.startedAt + rule.windowMs - now };
  return { window: { startedAt: window.startedAt, count: window.count + 1 }, allowed: true, retryAfterMs: 0 };
}

// Whether a window has ended, so the store can forget it.
export function isOver(window: Window, rule: Rule, now: number): boolean {
  return now >= window.startedAt + rule.windowMs;
}
