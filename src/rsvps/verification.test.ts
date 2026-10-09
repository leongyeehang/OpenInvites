import { describe, expect, it } from "vitest";
import { CODE_MINUTES, codeVerdict, generateCode, hashCode, MAX_ATTEMPTS, needsCode, RESEND_SECONDS, resendIn } from "./verification";

const sent = new Date("2027-03-01T10:00:00Z");
const after = (seconds: number) => new Date(sent.getTime() + seconds * 1000);

describe("generateCode", () => {
  it("draws six digits, leading zeros kept, rarely the same twice", () => {
    const codes = Array.from({ length: 1000 }, generateCode);
    for (const code of codes) expect(code).toMatch(/^[0-9]{6}$/);
    // Every digit leads some of them, a zero among them: one in ten starts with each.
    expect(new Set(codes.map((code) => code[0])).size).toBe(10);
    expect(new Set(codes).size).toBeGreaterThan(990);
  });
});

describe("hashCode", () => {
  it("is the SHA-256 of the code, in hex", () => {
    expect(hashCode("012345")).toBe("2224512ef44a62e580bb1c0dcb33aff688f4e7da8a488aeb4e7ca402c5cacf45");
  });
});

describe("needsCode", () => {
  const asking = { verifyEmail: true, emailField: "optional", mailConfigured: true, email: "priya@example.com", current: undefined } as const;
  const proven = { email: "priya@example.com", emailVerifiedAt: sent };

  it("asks a new guest who gives an email, when the host checks it and the instance has mail", () => {
    expect(needsCode(asking)).toBe(true);
    expect(needsCode({ ...asking, emailField: "required" })).toBe(true);
  });

  it("asks nothing when the host does not check the email", () => {
    expect(needsCode({ ...asking, verifyEmail: false })).toBe(false);
  });

  it("asks nothing when the form does not ask for an email", () => {
    expect(needsCode({ ...asking, emailField: "none" })).toBe(false);
  });

  it("asks nothing without mail, as if the host had not asked", () => {
    expect(needsCode({ ...asking, mailConfigured: false })).toBe(false);
  });

  it("asks nothing of a guest who gives no email", () => {
    for (const email of [null, undefined, ""]) expect(needsCode({ ...asking, email })).toBe(false);
  });

  it("asks nothing when the reply keeps an email already proven", () => {
    expect(needsCode({ ...asking, current: proven })).toBe(false);
  });

  it("asks again when the email changes, or was never proven", () => {
    expect(needsCode({ ...asking, current: { ...proven, email: "priya@example.org" } })).toBe(true);
    expect(needsCode({ ...asking, current: { ...proven, email: null } })).toBe(true);
    expect(needsCode({ ...asking, current: { ...proven, emailVerifiedAt: null } })).toBe(true);
  });
});

describe("codeVerdict", () => {
  const row = { codeHash: hashCode("042917"), expiresAt: new Date(sent.getTime() + CODE_MINUTES * 60_000), attempts: 0 };

  it("takes the code it was sent, spaces around it ignored", () => {
    expect(codeVerdict(row, "042917", sent)).toBe("ok");
    expect(codeVerdict(row, " 042917 ", sent)).toBe("ok");
  });

  it("refuses any other code", () => {
    expect(codeVerdict(row, "042918", sent)).toBe("wrong");
    expect(codeVerdict(row, "42917", sent)).toBe("wrong");
    expect(codeVerdict(row, "", sent)).toBe("wrong");
  });

  it("lasts ten minutes, and not a moment longer", () => {
    expect(codeVerdict(row, "042917", after(CODE_MINUTES * 60 - 1))).toBe("ok");
    expect(codeVerdict(row, "042917", after(CODE_MINUTES * 60))).toBe("expired");
    expect(codeVerdict(row, "042918", after(CODE_MINUTES * 60))).toBe("expired");
  });

  it("lasts five wrong tries: a sixth asks for a new code, even the right one", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(codeVerdict({ ...row, attempts: MAX_ATTEMPTS - 1 }, "042917", sent)).toBe("ok");
    expect(codeVerdict({ ...row, attempts: MAX_ATTEMPTS - 1 }, "042918", sent)).toBe("wrong");
    expect(codeVerdict({ ...row, attempts: MAX_ATTEMPTS }, "042917", sent)).toBe("tooManyAttempts");
    expect(codeVerdict({ ...row, attempts: MAX_ATTEMPTS }, "042918", sent)).toBe("tooManyAttempts");
  });
});

describe("resendIn", () => {
  it("counts down the thirty seconds after a code is sent, then lets another go", () => {
    expect(RESEND_SECONDS).toBe(30);
    expect(resendIn({ createdAt: sent }, sent)).toBe(30);
    expect(resendIn({ createdAt: sent }, after(0.2))).toBe(30);
    expect(resendIn({ createdAt: sent }, after(29))).toBe(1);
    expect(resendIn({ createdAt: sent }, after(29.9))).toBe(1);
    expect(resendIn({ createdAt: sent }, after(30))).toBe(0);
    expect(resendIn({ createdAt: sent }, after(3600))).toBe(0);
  });
});
