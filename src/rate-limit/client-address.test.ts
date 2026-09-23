import { describe, expect, it } from "vitest";
import { clientAddress } from "./client-address";

// X-Forwarded-For grows by one entry at each proxy: every proxy appends the address of whoever
// connected to it. Only the entries the operator's own proxies wrote can be believed; anything
// further left came from the client, which can write whatever it likes.
describe("clientAddress", () => {
  it("takes the address the one reverse proxy appended", () => {
    expect(clientAddress("203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("ignores whatever a client wrote in front of it", () => {
    expect(clientAddress("6.6.6.6, 203.0.113.7", 1)).toBe("203.0.113.7");
    expect(clientAddress("6.6.6.6,1.1.1.1,203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("counts from the right, one entry per trusted proxy, to the one the outermost appended", () => {
    // A CDN appended the client's address, then the proxy beside the app appended the CDN's.
    expect(clientAddress("6.6.6.6, 198.51.100.4, 10.0.0.2", 2)).toBe("198.51.100.4");
    expect(clientAddress("198.51.100.4, 10.0.0.2", 2)).toBe("198.51.100.4");
  });

  it("takes the leftmost entry when there are fewer than the trusted proxies, as every one was written by them", () => {
    expect(clientAddress("198.51.100.4", 2)).toBe("198.51.100.4");
  });

  it("reads IPv6 addresses and spaces around entries", () => {
    expect(clientAddress(" 2001:db8::1 ", 1)).toBe("2001:db8::1");
    expect(clientAddress("6.6.6.6 ,  2001:db8::7", 1)).toBe("2001:db8::7");
  });

  it("finds no address when no proxy is trusted, whatever the header says", () => {
    expect(clientAddress("203.0.113.7", 0)).toBeNull();
  });

  it("finds no address when the header is missing or empty", () => {
    expect(clientAddress(null, 1)).toBeNull();
    expect(clientAddress("", 1)).toBeNull();
    expect(clientAddress(" , ", 1)).toBeNull();
  });

  it("finds no address when the entry a proxy should have written is not one", () => {
    expect(clientAddress("unknown", 1)).toBeNull();
    expect(clientAddress("203.0.113.7, not-an-address", 1)).toBeNull();
    expect(clientAddress("203.0.113.7:4711", 1)).toBeNull();
  });
});
