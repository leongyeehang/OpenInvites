import { createHash, randomBytes } from "node:crypto";
import { baseUrl } from "@/instance/env";

// A co-host link makes whoever accepts it a co-host of one event (spec, "Co-hosts"). It works once,
// for seven days, and its owner can revoke it until then. It admits nobody to the instance: only a
// host who is signed in can accept it.

export const CO_HOST_LINK_DAYS = 7;

// The most co-hosts an event can have.
export const MAX_CO_HOSTS = 10;

const DAY = 24 * 60 * 60 * 1000;

export type CoHostLinkState = "pending" | "used" | "revoked" | "expired";

export function coHostLinkExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + CO_HOST_LINK_DAYS * DAY);
}

// Used and revoked are for good, so they win over the clock: a link says what happened to it
// rather than only that it no longer works. The statement that uses one up (hosts/repository.ts)
// asks the same three questions under a lock.
export function coHostLinkState(link: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): CoHostLinkState {
  if (link.usedAt) return "used";
  if (link.revokedAt) return "revoked";
  return now < link.expiresAt ? "pending" : "expired";
}

export function roomForCoHost(coHosts: number): boolean {
  return coHosts < MAX_CO_HOSTS;
}

// The link is the credential, as a host invitation's is: 24 random bytes from a cryptographic
// source, written as URL-safe base64. Only a plain SHA-256 of it is stored, which is enough for a
// random token, so a copy of the database hands out no co-host links.
export function generateCoHostLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashCoHostLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function coHostLinkUrl(token: string): string {
  return `${baseUrl()}/co-host/${token}`;
}
