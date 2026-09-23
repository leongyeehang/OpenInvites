import { clientAddress } from "./client-address";
import { rateLimitConfig, type LimitName, type RateLimitConfig } from "./config";
import { countRequest, isOver, type Rule, type Window } from "./window";

export type { LimitName } from "./config";

export type Verdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// Where the counts are kept. M1 runs one application container, so they live in its memory
// (spec, "Operator configuration"); a store shared by several containers would take its place
// behind this interface.
export interface RateLimitStore {
  hit(key: string, rule: Rule, now: number): Promise<Verdict>;
}

const SWEEP_EVERY_MS = 60_000;

class MemoryStore implements RateLimitStore {
  private readonly windows = new Map<string, { window: Window; rule: Rule }>();
  private sweptAt = 0;

  async hit(key: string, rule: Rule, now: number): Promise<Verdict> {
    this.sweep(now);
    const outcome = countRequest(this.windows.get(key)?.window, rule, now);
    this.windows.set(key, { window: outcome.window, rule });
    if (outcome.allowed) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(outcome.retryAfterMs / 1000)) };
  }

  // Windows that are over are forgotten once a minute, so memory follows the clients seen lately.
  private sweep(now: number) {
    if (now - this.sweptAt < SWEEP_EVERY_MS) return;
    this.sweptAt = now;
    for (const [key, { window, rule }] of this.windows) if (isOver(window, rule, now)) this.windows.delete(key);
  }
}

// The proxy (src/proxy.ts) is bundled apart from the rest of the app but runs in the same
// process, so the one store hangs off the process's global object rather than off a module:
// every limit is counted in one place, whichever code asks.
const SHARED = Symbol.for("openinvites.rateLimit");

type Shared = { store: RateLimitStore; config: RateLimitConfig; toldNoAddress: boolean };

function shared(): Shared {
  const global = globalThis as { [SHARED]?: Shared };
  global[SHARED] ??= { store: new MemoryStore(), config: rateLimitConfig(), toldNoAddress: false };
  return global[SHARED];
}

// Counts one request against a limit, for the client the request's headers say it comes from,
// and says whether it may go ahead. Every limit is counted this way, by client address
// (client-address.ts).
export async function consume(limit: LimitName, headers: Headers): Promise<Verdict> {
  const { store, config } = shared();
  const address = clientAddress(headers.get("x-forwarded-for"), config.trustedProxyHops) ?? everyone(config.trustedProxyHops);
  return store.hit(`${limit} ${address}`, config.rules[limit], Date.now());
}

// A request whose client cannot be told apart counts together with every other such request.
// With no trusted proxy that is every request, which the log says once at start
// (checkRateLimitsAtStart); otherwise the first one says so.
function everyone(trustedProxyHops: number): string {
  const state = shared();
  if (trustedProxyHops > 0 && !state.toldNoAddress) {
    state.toldNoAddress = true;
    console.warn(
      `Rate limits: a request came with no client address in X-Forwarded-For, although TRUSTED_PROXY_HOPS is ${trustedProxyHops}. ` +
        "Requests like it share one allowance per limit for the whole instance. Check that clients reach the app only through its reverse proxy.",
    );
  }
  return "*";
}

// The header that tells a refused client when to come back.
export function retryAfter(verdict: { retryAfterSeconds: number }): Record<string, string> {
  return { "Retry-After": String(verdict.retryAfterSeconds) };
}

// At start: a limit that cannot be read stops the app, and an instance that trusts no proxy says
// what that means for its limits.
export function checkRateLimitsAtStart(): void {
  if (rateLimitConfig().trustedProxyHops === 0) {
    console.warn(
      "Rate limits: TRUSTED_PROXY_HOPS is 0, so no client address is believed and every limit counts all requests to this instance together.",
    );
  }
}
