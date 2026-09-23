import { isIP } from "node:net";

// Who a request comes from, as the operator's reverse proxies say (spec, "Operator
// configuration"). A route handler never sees the connection itself, only the headers the
// proxies in front of the app added. Each proxy appends to X-Forwarded-For the address of
// whoever connected to it, so with `trustedHops` proxies in front, the entry that many places
// from the right is the one the outermost proxy appended: the client's own address. Entries
// further left were written by the client and are never believed. Fewer entries than proxies
// means some proxy was skipped, and every entry there is still one of theirs, so the leftmost is
// the nearest to the client. Null when nothing can be believed: no trusted proxy, no header, or
// an entry that is not an address.
export function clientAddress(forwardedFor: string | null, trustedHops: number): string | null {
  if (trustedHops < 1 || !forwardedFor) return null;
  const entries = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;
  const address = entries[Math.max(0, entries.length - trustedHops)];
  return isIP(address) ? address : null;
}
