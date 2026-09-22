import { describe, expect, it } from "vitest";
import { parseRsvpForm, type RsvpSettings } from "./form";

const settings: RsvpSettings = { plusOnesAllowed: 2, requirePlusOneNames: false, askEmail: false };

const going = { status: "going", name: "Priya Nair", plusOnes: "0", plusOneNames: [], email: "" };

describe("parseRsvpForm", () => {
  it("turns the form's strings into an answer, trimming what the guest typed", () => {
    expect(parseRsvpForm({ ...going, name: "  Priya Nair ", plusOnes: "2", plusOneNames: ["Arjun", " "] }, settings)).toEqual({
      ok: true,
      input: { status: "going", name: "Priya Nair", plusOnes: 2, plusOneNames: ["Arjun", ""], email: null },
    });
  });

  it("wants a name, and one of the three statuses", () => {
    expect(parseRsvpForm({ ...going, name: "   " }, settings)).toEqual({ ok: false, error: "nameRequired" });
    expect(parseRsvpForm({ ...going, status: "perhaps" }, settings)).toEqual({ ok: false, error: "statusInvalid" });
    expect(parseRsvpForm({ ...going, name: "a".repeat(81) }, settings)).toEqual({ ok: false, error: "nameTooLong" });
  });

  it("keeps plus-ones within what the host allows", () => {
    expect(parseRsvpForm({ ...going, plusOnes: "3" }, settings)).toEqual({ ok: false, error: "plusOnesInvalid" });
    expect(parseRsvpForm({ ...going, plusOnes: "-1" }, settings)).toEqual({ ok: false, error: "plusOnesInvalid" });
    expect(parseRsvpForm({ ...going, plusOnes: "two" }, settings)).toEqual({ ok: false, error: "plusOnesInvalid" });
    expect(parseRsvpForm({ ...going, plusOnes: "1" }, { ...settings, plusOnesAllowed: 0 })).toEqual({
      ok: false,
      error: "plusOnesInvalid",
    });
  });

  it("brings nobody along for a guest who can’t go", () => {
    expect(parseRsvpForm({ ...going, status: "cant", plusOnes: "2", plusOneNames: ["Arjun", "Meera"] }, settings)).toEqual({
      ok: true,
      input: { status: "cant", name: "Priya Nair", plusOnes: 0, plusOneNames: [], email: null },
    });
  });

  it("asks for every plus-one’s name when the host requires them", () => {
    const named: RsvpSettings = { ...settings, requirePlusOneNames: true };
    expect(parseRsvpForm({ ...going, plusOnes: "2", plusOneNames: ["Arjun", " "] }, named)).toEqual({
      ok: false,
      error: "plusOneNameRequired",
    });
    expect(parseRsvpForm({ ...going, plusOnes: "2", plusOneNames: ["Arjun", "Meera"] }, named).ok).toBe(true);
    // Nobody to bring, so nothing to name.
    expect(parseRsvpForm({ ...going, plusOnes: "0" }, named).ok).toBe(true);
    expect(parseRsvpForm({ ...going, plusOnes: "1", plusOneNames: ["a".repeat(81)] }, named)).toEqual({
      ok: false,
      error: "plusOneNameTooLong",
    });
  });

  it("takes an email only when the host asks for one, and only a plausible one", () => {
    const asking: RsvpSettings = { ...settings, askEmail: true };
    const emailOf = (fields: Parameters<typeof parseRsvpForm>[0], of: RsvpSettings) => {
      const parsed = parseRsvpForm(fields, of);
      return parsed.ok ? parsed.input.email : parsed.error;
    };
    expect(emailOf({ ...going, email: " priya@example.com " }, asking)).toBe("priya@example.com");
    // Optional even when asked for: M3 is where an email can be made compulsory.
    expect(emailOf({ ...going, email: "  " }, asking)).toBe(null);
    expect(emailOf({ ...going, email: "priya at example" }, asking)).toBe("emailInvalid");
    // The host is not asking, so an address posted anyway is ignored.
    expect(emailOf({ ...going, email: "priya@example.com" }, settings)).toBe(null);
  });
});
