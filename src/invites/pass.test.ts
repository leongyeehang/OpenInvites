import { describe, expect, it } from "vitest";
import { PASS_DAYS, passCookieName, passExpiresAt, readPass, signPass } from "./pass";

const SECRET = "a-secret-of-at-least-thirty-two-characters";
const EVENT = "6f1c2a52-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
const OTHER_EVENT = "7a2d3b63-4c5e-4f60-9b0c-1d2e3f4a5b6c";
const INVITE = "0b9e8d7c-6b5a-4f3e-9d2c-1b0a9f8e7d6c";
const NOW = new Date("2027-03-01T12:00:00Z");
const YEAR_ON = new Date(NOW.getTime() + PASS_DAYS * 24 * 60 * 60 * 1000);

describe("passCookieName", () => {
  it("is named after the event, so a device can hold a pass to several", () => {
    expect(passCookieName(EVENT)).toBe(`pass_${EVENT}`);
  });
});

describe("a pass", () => {
  const pass = signPass({ eventId: EVENT, inviteId: INVITE, expiresAt: YEAR_ON }, SECRET);

  it("is the invite's id, its expiry and a signature", () => {
    expect(pass).toMatch(new RegExp(`^${INVITE}\\.${YEAR_ON.getTime()}\\.[0-9a-f]{64}$`));
  });

  it("reads back as its invite until it expires", () => {
    expect(readPass(pass, EVENT, SECRET, NOW)).toEqual({ inviteId: INVITE });
    expect(readPass(pass, EVENT, SECRET, new Date(YEAR_ON.getTime() - 1))).toEqual({ inviteId: INVITE });
    expect(readPass(pass, EVENT, SECRET, YEAR_ON)).toBeUndefined();
    expect(readPass(pass, EVENT, SECRET, new Date(YEAR_ON.getTime() + 1))).toBeUndefined();
  });

  it("is nothing under another secret", () => {
    expect(readPass(pass, EVENT, `${SECRET}-rotated`, NOW)).toBeUndefined();
  });

  it("is nothing for another event", () => {
    expect(readPass(pass, OTHER_EVENT, SECRET, NOW)).toBeUndefined();
  });

  it("is nothing once any part of it is altered", () => {
    const [invite, expires, mac] = pass.split(".");
    const otherInvite = "1c0f9e8d-7c6b-4a5f-8e3d-2c1b0a9f8e7d";
    expect(readPass(`${otherInvite}.${expires}.${mac}`, EVENT, SECRET, NOW)).toBeUndefined();
    expect(readPass(`${invite}.${Number(expires) + 1000}.${mac}`, EVENT, SECRET, NOW)).toBeUndefined();
    const flipped = `${mac.slice(0, -1)}${mac.endsWith("0") ? "1" : "0"}`;
    expect(readPass(`${invite}.${expires}.${flipped}`, EVENT, SECRET, NOW)).toBeUndefined();
    expect(readPass(`${invite}.${expires}.${mac.slice(0, -2)}`, EVENT, SECRET, NOW)).toBeUndefined();
    expect(readPass(`${invite}.${expires}`, EVENT, SECRET, NOW)).toBeUndefined();
    expect(readPass(`${pass}.more`, EVENT, SECRET, NOW)).toBeUndefined();
    expect(readPass("", EVENT, SECRET, NOW)).toBeUndefined();
    expect(readPass(undefined, EVENT, SECRET, NOW)).toBeUndefined();
  });

  it("signed for another invite or expiry is another pass", () => {
    const later = signPass({ eventId: EVENT, inviteId: INVITE, expiresAt: new Date(YEAR_ON.getTime() + 1000) }, SECRET);
    expect(later).not.toBe(pass);
    expect(readPass(later, EVENT, SECRET, NOW)).toEqual({ inviteId: INVITE });
  });
});

describe("passExpiresAt", () => {
  it("is a year on", () => {
    expect(passExpiresAt(NOW)).toEqual(YEAR_ON);
  });
});
