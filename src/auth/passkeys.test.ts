import { describe, expect, it } from "vitest";
import { parsePasskeyName, passkeysAvailable, relyingParty } from "./passkeys";

describe("passkeysAvailable", () => {
  it("offers passkeys over HTTPS anywhere", () => {
    expect(passkeysAvailable("https://invites.example.org")).toBe(true);
    expect(passkeysAvailable("https://invites.example.org:8443/")).toBe(true);
  });

  it("offers them over plain HTTP only on the machine itself", () => {
    expect(passkeysAvailable("http://localhost:3000")).toBe(true);
    expect(passkeysAvailable("http://127.0.0.1:3000")).toBe(true);
    expect(passkeysAvailable("http://[::1]:3000")).toBe(true);
    expect(passkeysAvailable("http://invites.localhost")).toBe(true);
    expect(passkeysAvailable("http://invites.example.org")).toBe(false);
    expect(passkeysAvailable("http://192.168.1.20:3000")).toBe(false);
  });
});

describe("relyingParty", () => {
  it("is the host name of BASE_URL, and its origin", () => {
    expect(relyingParty("https://invites.example.org/")).toEqual({ id: "invites.example.org", origin: "https://invites.example.org" });
    expect(relyingParty("http://localhost:3000")).toEqual({ id: "localhost", origin: "http://localhost:3000" });
  });
});

describe("parsePasskeyName", () => {
  it("takes a name trimmed, and refuses an empty or overlong one", () => {
    expect(parsePasskeyName("  Work laptop ")).toBe("Work laptop");
    expect(parsePasskeyName("   ")).toBeUndefined();
    expect(parsePasskeyName("x".repeat(61))).toBeUndefined();
    expect(parsePasskeyName(undefined)).toBeUndefined();
  });
});
