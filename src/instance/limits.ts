import { DEFAULT_RETENTION_DAYS, RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "../retention/plan";

// The limits the operator sets on the instance settings page (spec, "Operator limits"): how many
// events a host may own, how many replies an event may take, and how many days after it ends an
// event is kept (spec, "Retention"; null keeps it for ever). Each is read at the moment it is
// checked, so a change takes effect at once.

export type Limits = { maxEventsPerHost: number; maxRsvpsPerEvent: number; retentionDays: number | null };

export const DEFAULT_LIMITS: Limits = { maxEventsPerHost: 50, maxRsvpsPerEvent: 500, retentionDays: DEFAULT_RETENTION_DAYS };

export const LIMIT_MIN = 1;
export const LIMIT_MAX = 100_000;

export type LimitField = keyof Limits;

export type LimitsParse = { ok: true; limits: Limits } | { ok: false; field: LimitField };

// A limit is a whole number written in digits, within the range: no sign, decimal point or exponent.
function parseLimit(raw: string, min = LIMIT_MIN, max = LIMIT_MAX): number | undefined {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return value >= min && value <= max ? value : undefined;
}

// The form's fields as posted, or the first that is wrong. With Keep forever ticked the days are
// not read: the field is disabled then, and sends nothing.
export function parseLimits(fields: { maxEventsPerHost: string; maxRsvpsPerEvent: string; retentionDays: string; keepForever: boolean }): LimitsParse {
  const maxEventsPerHost = parseLimit(fields.maxEventsPerHost);
  if (maxEventsPerHost === undefined) return { ok: false, field: "maxEventsPerHost" };
  const maxRsvpsPerEvent = parseLimit(fields.maxRsvpsPerEvent);
  if (maxRsvpsPerEvent === undefined) return { ok: false, field: "maxRsvpsPerEvent" };
  const retentionDays = fields.keepForever ? null : parseLimit(fields.retentionDays, RETENTION_MIN_DAYS, RETENTION_MAX_DAYS);
  if (retentionDays === undefined) return { ok: false, field: "retentionDays" };
  return { ok: true, limits: { maxEventsPerHost, maxRsvpsPerEvent, retentionDays } };
}

// Whether one more would go past the limit. A limit lowered below what exists leaves what exists
// alone and refuses anything new.
export function atLimit(count: number, limit: number): boolean {
  return count >= limit;
}
