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

// One limit's windows, one per client, in the order they opened: a Map keeps its keys in the order
// they were added, a count within a window is updated in place, and a window that is over is
// forgotten before its client's next one is added at the back. With one rule for all of them,
// the windows that are over are always at the front, and each request forgets just those, which
// costs nothing when none are over. Past `maxClients` the oldest windows are forgotten first, so a
// flood of new clients can push counts out but never grow the table.
export class WindowTable {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly rule: Rule,
    private readonly maxClients: number,
  ) {}

  count(client: string, now: number): Outcome {
    for (const [oldest, window] of this.windows) {
      if (!isOver(window, this.rule, now)) break;
      this.windows.delete(oldest);
    }
    const current = this.windows.get(client);
    const outcome = countRequest(current, this.rule, now);
    if (outcome.window !== current) this.windows.set(client, outcome.window);
    for (const oldest of this.windows.keys()) {
      if (this.windows.size <= this.maxClients) break;
      this.windows.delete(oldest);
    }
    return outcome;
  }

  get size(): number {
    return this.windows.size;
  }
}
