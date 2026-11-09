import { describe, expect, it } from "vitest";
import { admitted, standsFor } from "./access";

// Who is in on an invite-only event (M6 spec, "Who is in"), apart from its hosts: a device with a
// pass, or one whose invite has no email to prove.
describe("admitted", () => {
  const withEmail = { email: "mei@example.test" };
  const phoneOnly = { email: null };

  it("lets in a device with a pass, whatever its invite", () => {
    expect(admitted({ pass: true, invite: withEmail })).toBe(true);
    expect(admitted({ pass: true, invite: phoneOnly })).toBe(true);
  });

  it("lets in a device that opened the link of an invite with no email", () => {
    expect(admitted({ pass: false, invite: phoneOnly })).toBe(true);
  });

  it("keeps out a device that holds only the link of an invite with an email, or its reply's edit link", () => {
    // The invite cookie the link left, or the RSVP cookie of the reply tied to the invite: either
    // way the device stands for the invite, and the invite's email is proven by a pass alone.
    expect(admitted({ pass: false, invite: withEmail })).toBe(false);
  });

  it("keeps out a device that stands for no invite", () => {
    expect(admitted({ pass: false, invite: undefined })).toBe(false);
  });
});

// Which invite a device stands for (M6 final review, B3): a pass's invite first, then the invite of
// the reply the device holds, then the invite its cookie names. The reply is the stronger claim: a
// guest who replied and then opened someone else's forwarded link is still that guest.
describe("standsFor", () => {
  type Held = { id: string; email: string | null };
  const mei: Held = { id: "mei", email: "mei@example.test" };
  const dev: Held = { id: "dev", email: null };
  const ana: Held = { id: "ana", email: "ana@example.test" };

  it("is the pass's invite, with the pass, whatever else the device holds", () => {
    expect(standsFor({ passed: ana, replied: dev, cookie: mei })).toEqual({ invite: ana, pass: true });
  });

  it("is the invite of the reply the device holds before the invite its cookie names", () => {
    expect(standsFor({ passed: undefined, replied: dev, cookie: mei })).toEqual({ invite: dev, pass: false });
    // So a phone-only guest who opened an email invite's forwarded link is still let in.
    expect(admitted(standsFor({ passed: undefined, replied: dev, cookie: mei }))).toBe(true);
  });

  it("is the cookie's invite when the device holds no reply tied to one", () => {
    expect(standsFor({ passed: undefined, replied: undefined, cookie: mei })).toEqual({ invite: mei, pass: false });
  });

  it("is nothing when the device holds none of them", () => {
    expect(standsFor({ passed: undefined, replied: undefined, cookie: undefined })).toEqual({ invite: undefined, pass: false });
  });
});
