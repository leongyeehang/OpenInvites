import { clientKey } from "./client-key";
import { rateLimitConfig, type LimitName, type RateLimitConfig } from "./config";
import { WindowTable, type Rule } from "./window";

export type { LimitName } from "./config";

export type Verdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// Where the counts are kept. M1 runs one application container, so they live in its memory
// (spec, "Operator configuration"); a store shared by several containers would take its place
// behind this interface.
export interface RateLimitStore {
  hit(limit: LimitName, client: string, rule: Rule, now: number): Promise<Verdict>;
}

// The most clients one limit keeps a count for: a window costs about 200 bytes, so this is about
// 4 MB a limit at worst. Past it, the oldest windows are forgotten first (window.ts), so a flood
// of addresses can only make the limit forget older clients sooner, never exhaust the memory.
const MAX_CLIENTS_PER_LIMIT = 20_000;

class MemoryStore implements RateLimitStore {
  private readonly tables = new Map<LimitName, WindowTable>();

  async hit(limit: LimitName, client: string, rule: Rule, now: number): Promise<Verdict> {
    let table = this.tables.get(limit);
    if (!table) this.tables.set(limit, (table = new WindowTable(rule, MAX_CLIENTS_PER_LIMIT)));
    const outcome = table.count(client, now);
    if (outcome.allowed) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(outcome.retryAfterMs / 1000)) };
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
// and says whether it may go ahead. Every limit is counted this way, by client (client-key.ts).
export async function consume(limit: LimitName, headers: Headers): Promise<Verdict> {
  const { store, config } = shared();
  const client = clientKey(headers.get("x-forwarded-for"), config.trustedProxyHops) ?? everyone(config.trustedProxyHops);
  return store.hit(limit, client, config.rules[limit], Date.now());
}

// Counts one request against several limits in turn, and stops at the first that refuses it.
export async function consumeAll(limits: readonly LimitName[], headers: Headers): Promise<Verdict> {
  for (const limit of limits) {
    const verdict = await consume(limit, headers);
    if (!verdict.allowed) return verdict;
  }
  return { allowed: true };
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
