import { describe, expect, it } from "vitest";
import { admitted } from "./access";

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
