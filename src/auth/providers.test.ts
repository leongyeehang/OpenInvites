import { describe, expect, it } from "vitest";
import { enabledSocialProviders, socialProvidersFromEnv } from "./providers";

describe("socialProvidersFromEnv", () => {
  it("has neither provider when nothing is set", () => {
    expect(socialProvidersFromEnv({})).toEqual({ google: null, github: null });
  });

  it("enables a provider only when both its client id and secret are set", () => {
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_ID: "id" })).toEqual({ google: null, github: null });
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_SECRET: "secret" })).toEqual({ google: null, github: null });
    expect(socialProvidersFromEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).toEqual({
      google: { clientId: "id", clientSecret: "secret" },
      github: null,
    });
  });

  it("treats blank values as unset", () => {
    expect(socialProvidersFromEnv({ GITHUB_CLIENT_ID: "   ", GITHUB_CLIENT_SECRET: "secret" })).toEqual({
      google: null,
      github: null,
    });
  });

  it("enables both providers independently", () => {
    expect(
      socialProvidersFromEnv({
        GOOGLE_CLIENT_ID: "g-id",
        GOOGLE_CLIENT_SECRET: "g-secret",
        GITHUB_CLIENT_ID: "h-id",
        GITHUB_CLIENT_SECRET: "h-secret",
      }),
    ).toEqual({
      google: { clientId: "g-id", clientSecret: "g-secret" },
      github: { clientId: "h-id", clientSecret: "h-secret" },
    });
  });
});

describe("enabledSocialProviders", () => {
  it("lists no providers when none are configured", () => {
    expect(enabledSocialProviders({ google: null, github: null })).toEqual([]);
  });

  it("lists only the configured providers, google before github", () => {
    expect(enabledSocialProviders({ google: null, github: { clientId: "id", clientSecret: "s" } })).toEqual(["github"]);
    expect(
      enabledSocialProviders({
        google: { clientId: "id", clientSecret: "s" },
        github: { clientId: "id", clientSecret: "s" },
      }),
    ).toEqual(["google", "github"]);
  });
});
