// Passkeys (M4 ticket 08). A browser offers WebAuthn only on a secure origin: HTTPS, or the
// machine's own address over plain HTTP. An instance anywhere else does not offer passkeys at all,
// and the account page says why. A passkey belongs to the domain it was made on (the relying
// party, the host name of BASE_URL), so a new domain strands every passkey made on the old one.

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function passkeysAvailable(baseUrl: string): boolean {
  const url = new URL(baseUrl);
  return url.protocol === "https:" || (url.protocol === "http:" && (LOOPBACK.has(url.hostname) || url.hostname.endsWith(".localhost")));
}

// The relying party a passkey is made for, and the origin a browser must be at to use it.
export function relyingParty(baseUrl: string): { id: string; origin: string } {
  const url = new URL(baseUrl);
  return { id: url.hostname, origin: url.origin };
}

// The longest name a host can give a passkey.
export const MAX_PASSKEY_NAME = 60;

// A name as typed: trimmed, and refused if empty or too long.
export function parsePasskeyName(posted: unknown): string | undefined {
  if (typeof posted !== "string") return undefined;
  const name = posted.trim();
  return name && name.length <= MAX_PASSKEY_NAME ? name : undefined;
}
