import { describe, expect, it } from "vitest";
import { clientKey } from "./client-key";

// X-Forwarded-For grows by one entry at each proxy: every proxy appends the address of whoever
// connected to it. Only the entries the operator's own proxies wrote can be believed; anything
// further left came from the client, which can write whatever it likes.
describe("clientKey: which entry to believe", () => {
  it("takes the address the one reverse proxy appended", () => {
    expect(clientKey("203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("ignores whatever a client wrote in front of it", () => {
    expect(clientKey("6.6.6.6, 203.0.113.7", 1)).toBe("203.0.113.7");
    expect(clientKey("6.6.6.6,1.1.1.1,203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("counts from the right, one entry per trusted proxy, to the one the outermost appended", () => {
    // A CDN appended the client's address, then the proxy beside the app appended the CDN's.
    expect(clientKey("6.6.6.6, 198.51.100.4, 10.0.0.2", 2)).toBe("198.51.100.4");
    expect(clientKey("198.51.100.4, 10.0.0.2", 2)).toBe("198.51.100.4");
  });

  it("takes the leftmost entry when there are fewer than the trusted proxies, as every one was written by them", () => {
    expect(clientKey("198.51.100.4", 2)).toBe("198.51.100.4");
  });

  it("reads spaces around entries", () => {
    expect(clientKey(" 203.0.113.7 ", 1)).toBe("203.0.113.7");
    expect(clientKey("6.6.6.6 ,  203.0.113.8", 1)).toBe("203.0.113.8");
  });

  it("finds no client when no proxy is trusted, whatever the header says", () => {
    expect(clientKey("203.0.113.7", 0)).toBeNull();
  });

  it("finds no client when the header is missing or empty", () => {
    expect(clientKey(null, 1)).toBeNull();
    expect(clientKey("", 1)).toBeNull();
    expect(clientKey(" , ", 1)).toBeNull();
  });

  it("finds no client when the entry a proxy should have written is not an address", () => {
    expect(clientKey("unknown", 1)).toBeNull();
    expect(clientKey("203.0.113.7, not-an-address", 1)).toBeNull();
    expect(clientKey("203.0.113.7:4711", 1)).toBeNull();
  });
});

// One IPv6 client usually holds a whole /64 (a home line, a server), and can take any address in
// it, so the /64 is the client. An IPv4 address carried in IPv6 is the IPv4 client it names.
describe("clientKey: one key per client", () => {
  it("keys every address in one /64 alike, however it is written", () => {
    const key = clientKey("2001:db8:1:2::1", 1);
    expect(key).toBe("2001:db8:1:2::/64");
    expect(clientKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd", 1)).toBe(key);
    expect(clientKey("2001:0DB8:0001:0002:0:0:0:ffff", 1)).toBe(key);
    expect(clientKey("6.6.6.6, 2001:db8:1:2:ffff::", 1)).toBe(key);
  });

  it("keys different /64s apart", () => {
    expect(clientKey("2001:db8:1:3::1", 1)).toBe("2001:db8:1:3::/64");
    expect(clientKey("2001:db8::1", 1)).toBe("2001:db8:0:0::/64");
    expect(clientKey("::1", 1)).toBe("0:0:0:0::/64");
  });

  it("drops a zone after the address", () => {
    expect(clientKey("fe80::1%eth0", 1)).toBe("fe80:0:0:0::/64");
  });

  it("turns an IPv4 address mapped into IPv6 back into that IPv4 address", () => {
    expect(clientKey("::ffff:203.0.113.7", 1)).toBe("203.0.113.7");
    expect(clientKey("::FFFF:cb00:7107", 1)).toBe("203.0.113.7");
    expect(clientKey("0:0:0:0:0:ffff:203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("keeps an IPv4 address as it is", () => {
    expect(clientKey("198.51.100.4", 1)).toBe("198.51.100.4");
  });
});
