export type TurnstileConfig = { siteKey: string; secretKey: string };

// Cloudflare Turnstile (spec, "Turnstile"): on when the operator sets both of its keys, off when
// neither. One without the other keeps the app from starting, rather than showing a widget whose
// tokens can never be checked, or checking tokens no widget can give.
export function turnstileConfigFromEnv(env: Record<string, string | undefined>): TurnstileConfig | null {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim();
  if (!siteKey && !secretKey) return null;
  if (!siteKey || !secretKey) throw new Error("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be set together");
  return { siteKey, secretKey };
}

export function turnstileConfig(): TurnstileConfig | null {
  return turnstileConfigFromEnv(process.env);
}

export function isTurnstileConfigured(): boolean {
  return turnstileConfig() !== null;
}

// The widget's key, which the pages that show it hand the browser; nothing when the check is off.
export function turnstileSiteKey(): string | undefined {
  return turnstileConfig()?.siteKey;
}
