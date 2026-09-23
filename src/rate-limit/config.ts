import type { Rule } from "./window";

// What the rate limits protect (spec, "Operator configuration"): every request under an event
// link, RSVPs, uploads, signing up, signing in (and anything else that checks a password),
// resetting a password, and every request that sends someone an email.
export type LimitName = "eventPage" | "rsvp" | "upload" | "signUp" | "signIn" | "passwordReset" | "mail";

export type RateLimitConfig = { trustedProxyHops: number; rules: Record<LimitName, Rule> };

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Each limit is one environment variable, a count per window such as "60/10m". The defaults
// are for people, some of whom share an address (an office, a phone network): generous enough
// that a household or a team answering together is never turned away, tight enough that a
// script cannot flood a guest list, an inbox, or a password.
const LIMITS: Record<LimitName, { variable: string; default: Rule }> = {
  eventPage: { variable: "RATE_LIMIT_EVENT_PAGE", default: { limit: 120, windowMs: MINUTE } },
  rsvp: { variable: "RATE_LIMIT_RSVP", default: { limit: 60, windowMs: 10 * MINUTE } },
  upload: { variable: "RATE_LIMIT_UPLOAD", default: { limit: 20, windowMs: 10 * MINUTE } },
  signUp: { variable: "RATE_LIMIT_SIGN_UP", default: { limit: 10, windowMs: HOUR } },
  signIn: { variable: "RATE_LIMIT_SIGN_IN", default: { limit: 10, windowMs: 15 * MINUTE } },
  passwordReset: { variable: "RATE_LIMIT_PASSWORD_RESET", default: { limit: 10, windowMs: HOUR } },
  // Mail goes to whatever address a request names, so this is what keeps the instance from
  // flooding someone else's inbox.
  mail: { variable: "RATE_LIMIT_MAIL", default: { limit: 10, windowMs: HOUR } },
};

const UNITS: Record<string, number> = { s: SECOND, m: MINUTE, h: HOUR };

export function rateLimitConfigFromEnv(env: Record<string, string | undefined>): RateLimitConfig {
  const rules = {} as Record<LimitName, Rule>;
  for (const [name, { variable, default: fallback }] of Object.entries(LIMITS) as [LimitName, (typeof LIMITS)[LimitName]][]) {
    const setting = env[variable]?.trim();
    rules[name] = setting ? parseRule(variable, setting) : fallback;
  }
  return { trustedProxyHops: parseHops(env.TRUSTED_PROXY_HOPS?.trim()), rules };
}

function parseRule(variable: string, setting: string): Rule {
  const match = /^(\d+)\s*\/\s*(\d+)\s*([smh])$/.exec(setting);
  const limit = match ? Number(match[1]) : 0;
  const window = match ? Number(match[2]) : 0;
  if (!match || limit < 1 || window < 1) {
    throw new Error(`${variable} must be a number of requests per a number of seconds, minutes or hours, such as "20/10m", not "${setting}"`);
  }
  return { limit, windowMs: window * UNITS[match[3]] };
}

// How many reverse proxies stand in front of the app, each appending to X-Forwarded-For
// (client-key.ts). One by default: the Caddy of the deployment package.
function parseHops(setting: string | undefined): number {
  if (!setting) return 1;
  if (!/^\d+$/.test(setting)) throw new Error(`TRUSTED_PROXY_HOPS must be the number of reverse proxies in front of the app, such as 1, not "${setting}"`);
  return Number(setting);
}

export function rateLimitConfig(): RateLimitConfig {
  return rateLimitConfigFromEnv(process.env);
}
