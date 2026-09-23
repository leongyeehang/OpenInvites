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
//
// The key is the client as the limits count it. An IPv4 address is its own client. An IPv6
// client usually holds a whole /64 (a home line, a server) and can take any address in it, so
// the /64 is the client; an IPv4 address carried in IPv6 (::ffff:a.b.c.d) is the IPv4 client it
// names.
export function clientKey(forwardedFor: string | null, trustedHops: number): string | null {
  if (trustedHops < 1 || !forwardedFor) return null;
  const entries = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;
  const address = entries[Math.max(0, entries.length - trustedHops)];
  const family = isIP(address);
  if (family === 4) return address;
  if (family !== 6) return null;
  const groups = hextets(address);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}

// The eight 16-bit groups of an IPv6 address node:net has already accepted: its zone dropped,
// an IPv4 tail read as the last two groups, and "::" filled with zeros.
function hextets(address: string): number[] {
  let text = address.split("%")[0].toLowerCase();
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = rest ? rest.split(":") : [];
  const groups = rest === undefined ? left : [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return groups.map((group) => parseInt(group, 16));
}
