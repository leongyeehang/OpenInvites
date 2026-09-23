export type SocialProviderId = "google" | "github";

export type SocialProviderConfig = { clientId: string; clientSecret: string };

export type SocialProvidersConfig = Record<SocialProviderId, SocialProviderConfig | null>;

// Google and GitHub, each on only when both its client id and secret are set (spec, "Identity
// and access"). Half-configured is off: a host is never shown a button that fails when clicked
// (spec, story 3).
export function socialProvidersFromEnv(env: Record<string, string | undefined>): SocialProvidersConfig {
  return {
    google: providerFromEnv(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    github: providerFromEnv(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
  };
}

function providerFromEnv(clientId: string | undefined, clientSecret: string | undefined): SocialProviderConfig | null {
  const id = clientId?.trim();
  const secret = clientSecret?.trim();
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}

export function socialProviders(): SocialProvidersConfig {
  return socialProvidersFromEnv(process.env);
}

// Which providers to show a sign-in button for. The sign-in and sign-up pages call this when
// they render; the browser never tells them which providers exist.
export function enabledSocialProviders(config: SocialProvidersConfig = socialProviders()): SocialProviderId[] {
  return (["google", "github"] as const).filter((id) => config[id] !== null);
}
