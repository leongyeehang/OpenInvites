// The two limits the operator sets on the instance settings page (spec, "Operator limits"): how
// many events a host may own and how many replies an event may take. Both are read at the moment
// they are checked, so a change takes effect at once.

export type Limits = { maxEventsPerHost: number; maxRsvpsPerEvent: number };

export const DEFAULT_LIMITS: Limits = { maxEventsPerHost: 50, maxRsvpsPerEvent: 500 };

export const LIMIT_MIN = 1;
export const LIMIT_MAX = 100_000;

export type LimitField = keyof Limits;

export type LimitsParse = { ok: true; limits: Limits } | { ok: false; field: LimitField };

// A limit is a whole number written in digits, within the range: no sign, decimal point or exponent.
function parseLimit(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value >= LIMIT_MIN && value <= LIMIT_MAX ? value : undefined;
}

// The form's two fields as posted, or the first that is wrong.
export function parseLimits(fields: { maxEventsPerHost: string; maxRsvpsPerEvent: string }): LimitsParse {
  const maxEventsPerHost = parseLimit(fields.maxEventsPerHost);
  if (maxEventsPerHost === undefined) return { ok: false, field: "maxEventsPerHost" };
  const maxRsvpsPerEvent = parseLimit(fields.maxRsvpsPerEvent);
  if (maxRsvpsPerEvent === undefined) return { ok: false, field: "maxRsvpsPerEvent" };
  return { ok: true, limits: { maxEventsPerHost, maxRsvpsPerEvent } };
}

// Whether one more would go past the limit. A limit lowered below what exists leaves what exists
// alone and refuses anything new.
export function atLimit(count: number, limit: number): boolean {
  return count >= limit;
}
