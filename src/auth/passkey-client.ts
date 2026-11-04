import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";

// The browser's half of a passkey (M4 ticket 08): the WebAuthn ceremony between the device and
// Better Auth's passkey endpoints (auth/auth.ts). Signing in and adding a passkey need it; renaming
// and removing one are server actions (auth/actions.ts).
export const passkeyAuth = createAuthClient({ plugins: [passkeyClient()] });

// What became of a passkey ceremony, as the page says it: done, cancelled by the person (which
// says nothing), refused as too fast, or failed.
export type PasskeyOutcome = "done" | "cancelled" | "tooFast" | "failed";

export function outcomeOf(result: { error: { status?: number; code?: string } | null }): PasskeyOutcome {
  if (!result.error) return "done";
  if (result.error.status === 429) return "tooFast";
  const code = result.error.code ?? "";
  return code === "AUTH_CANCELLED" || code === "ERROR_CEREMONY_ABORTED" || code.includes("CANCELLED") ? "cancelled" : "failed";
}
