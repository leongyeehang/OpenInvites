import { describe, expect, it } from "vitest";
import { isEmail, isPhone, parseHostEdit, parseRsvpForm, type ContactField, type RsvpSettings } from "./form";

const settings: RsvpSettings = { plusOnesAllowed: 2, requirePlusOneNames: false, emailField: "none", phoneField: "none" };

const going = { status: "going", name: "Priya Nair", plusOnes: "0", plusOneNames: [], email: "", phone: "" };

describe("parseRsvpForm", () => {
  it("turns the form's strings into an answer, trimming what the guest typed", () => {
    expect(parseRsvpForm({ ...going, name: "  Priya Nair ", plusOnes: "2", plusOneNames: ["Arjun", " "] }, settings)).toEqual({
      ok: true,
      input: { status: "going", name: "Priya Nair", plusOnes: 2, plusOneNames: ["Arjun", ""], email: undefined, phone: undefined },
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
      input: { status: "cant", name: "Priya Nair", plusOnes: 0, plusOneNames: [], email: undefined, phone: undefined },
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

  // What the form makes of a contact field, or why it refuses it. A field the host does not ask
  // for is undefined: the guest's save leaves what is stored there alone.
  const contactOf = (fields: Parameters<typeof parseRsvpForm>[0], of: RsvpSettings) => {
    const parsed = parseRsvpForm(fields, of);
    return parsed.ok ? { email: parsed.input.email, phone: parsed.input.phone } : parsed.error;
  };
  const asking = (emailField: ContactField, phoneField: ContactField): RsvpSettings => ({ ...settings, emailField, phoneField });

  it("takes an email only when the host asks for one, and only a plausible one", () => {
    for (const field of ["optional", "required"] as const) {
      expect(contactOf({ ...going, email: " priya@example.com " }, asking(field, "none"))).toStrictEqual({ email: "priya@example.com", phone: undefined });
      expect(contactOf({ ...going, email: "priya at example" }, asking(field, "none"))).toBe("emailInvalid");
    }
    // The host is not asking, so an address posted anyway is ignored, and the one stored, which
    // the host may have given, is left as it is.
    expect(contactOf({ ...going, email: "priya@example.com" }, settings)).toStrictEqual({ email: undefined, phone: undefined });
  });

  it("lets a guest leave the email blank unless the host requires it", () => {
    expect(contactOf({ ...going, email: "  " }, asking("none", "none"))).toStrictEqual({ email: undefined, phone: undefined });
    // Asked, and left blank: the guest takes back an email they gave.
    expect(contactOf({ ...going, email: "  " }, asking("optional", "none"))).toStrictEqual({ email: null, phone: undefined });
    expect(contactOf({ ...going, email: "  " }, asking("required", "none"))).toBe("emailRequired");
    // Required whatever the answer: a guest who can't go is asked it too.
    expect(contactOf({ ...going, status: "cant", email: "" }, asking("required", "none"))).toBe("emailRequired");
  });

  it("takes a phone number only when the host asks for one, as typed, and only a plausible one", () => {
    for (const field of ["optional", "required"] as const) {
      expect(contactOf({ ...going, phone: " +65 9123 4567 " }, asking("none", field))).toStrictEqual({ email: undefined, phone: "+65 9123 4567" });
      expect(contactOf({ ...going, phone: "12" }, asking("none", field))).toBe("phoneInvalid");
    }
    expect(contactOf({ ...going, phone: "+65 9123 4567" }, settings)).toStrictEqual({ email: undefined, phone: undefined });
  });

  it("lets a guest leave the phone number blank unless the host requires it", () => {
    expect(contactOf({ ...going, phone: " " }, asking("none", "none"))).toStrictEqual({ email: undefined, phone: undefined });
    expect(contactOf({ ...going, phone: " " }, asking("none", "optional"))).toStrictEqual({ email: undefined, phone: null });
    expect(contactOf({ ...going, phone: " " }, asking("none", "required"))).toBe("phoneRequired");
  });

  it("asks both together, and the email first", () => {
    expect(contactOf({ ...going, email: "priya@example.com", phone: "(02) 555-1234" }, asking("required", "required"))).toEqual({
      email: "priya@example.com",
      phone: "(02) 555-1234",
    });
    expect(contactOf(going, asking("required", "required"))).toBe("emailRequired");
    expect(contactOf({ ...going, email: "priya@example.com" }, asking("required", "required"))).toBe("phoneRequired");
  });
});

describe("isEmail", () => {
  it("wants something, an at sign, and a domain with a dot, within 254 characters", () => {
    expect(isEmail("priya@example.com")).toBe(true);
    expect(isEmail("priya at example")).toBe(false);
    expect(isEmail("priya@example")).toBe(false);
    expect(isEmail(`${"a".repeat(242)}@example.com`)).toBe(true);
    expect(isEmail(`${"a".repeat(243)}@example.com`)).toBe(false);
  });
});

describe("isPhone", () => {
  it("wants 5 to 20 characters", () => {
    expect(isPhone("1234")).toBe(false);
    expect(isPhone("12345")).toBe(true);
    expect(isPhone("1".repeat(20))).toBe(true);
    expect(isPhone("1".repeat(21))).toBe(false);
  });

  it("takes digits, spaces, plus, hyphens, brackets and dots, as people write numbers", () => {
    expect(isPhone("+65 9123 4567")).toBe(true);
    expect(isPhone("(02) 555-1234")).toBe(true);
    expect(isPhone("030.1234.5678")).toBe(true);
  });

  it("wants at least five digits among them", () => {
    expect(isPhone("-----")).toBe(false);
    expect(isPhone("(((((")).toBe(false);
    expect(isPhone("+ + +")).toBe(false);
    expect(isPhone("(1234)")).toBe(false);
    expect(isPhone("(12345)")).toBe(true);
  });

  it("refuses letters and anything else", () => {
    expect(isPhone("555-CALL-NOW")).toBe(false);
    expect(isPhone("9123 4567 ext 2")).toBe(false);
    expect(isPhone("9123/4567")).toBe(false);
    // Full-width digits are not the digits the rule means.
    expect(isPhone("９１２３４５６７")).toBe(false);
  });
});

describe("parseHostEdit", () => {
  const strict: RsvpSettings = { plusOnesAllowed: 2, requirePlusOneNames: true, emailField: "required", phoneField: "required" };
  const edit = { status: "maybe", name: "Priya Nair", plusOnes: "0", plusOneNames: [], email: "", phone: "" };

  it("takes the status, the guest's name, who they are bringing, and how to reach them", () => {
    expect(
      parseHostEdit(
        { ...edit, name: " Priya Nair ", plusOnes: "1", plusOneNames: ["Arjun", "Mei"], email: " priya@example.com ", phone: " +65 9123 4567 " },
        strict,
      ),
    ).toEqual({
      ok: true,
      edit: { status: "maybe", name: "Priya Nair", plusOnes: 1, plusOneNames: ["Arjun"], email: "priya@example.com", phone: "+65 9123 4567" },
    });
  });

  it("does not make the host give an email or a phone number the guest is asked for", () => {
    expect(parseHostEdit(edit, strict)).toEqual({
      ok: true,
      edit: { status: "maybe", name: "Priya Nair", plusOnes: 0, plusOneNames: [], email: null, phone: null },
    });
  });

  it("lets the host give an email or a phone number the guest is not asked for", () => {
    const asksNothing: RsvpSettings = { ...strict, emailField: "none", phoneField: "none" };
    const parsed = parseHostEdit({ ...edit, email: "priya@example.com", phone: "(02) 555-1234" }, asksNothing);
    expect(parsed.ok && parsed.edit).toMatchObject({ email: "priya@example.com", phone: "(02) 555-1234" });
  });

  it("holds the email and the phone number to the guest's rules of shape", () => {
    expect(parseHostEdit({ ...edit, email: "priya at example" }, strict)).toEqual({ ok: false, error: "emailInvalid" });
    expect(parseHostEdit({ ...edit, phone: "12" }, strict)).toEqual({ ok: false, error: "phoneInvalid" });
  });

  it("does not make the host invent names for someone else's plus-ones", () => {
    expect(parseHostEdit({ ...edit, plusOnes: "2", plusOneNames: [] }, strict)).toEqual({
      ok: true,
      edit: { status: "maybe", name: "Priya Nair", plusOnes: 2, plusOneNames: ["", ""], email: null, phone: null },
    });
  });

  it("holds the host to the allowance they set, and still wants a name", () => {
    expect(parseHostEdit({ ...edit, plusOnes: "3" }, strict)).toEqual({ ok: false, error: "plusOnesInvalid" });
    expect(parseHostEdit({ ...edit, name: "   " }, strict)).toEqual({ ok: false, error: "nameRequired" });
  });
});
