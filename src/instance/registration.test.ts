import { describe, expect, it } from "vitest";
import { isOperatorEmail, operatorEmailSeat, signUpNotice, signUpRefusal, type SignUpFacts } from "./registration";

describe("signUpRefusal", () => {
  const closed: SignUpFacts = { byOperatorEmail: false, firstAccount: false, mode: "invitationOnly", invitation: "none" };

  it("refuses a sign-up without a host invitation while registration is invitation only", () => {
    expect(signUpRefusal(closed)).toBe("HOST_INVITATION_REQUIRED");
  });

  it("says so when the host invitation it came with can no longer be used", () => {
    expect(signUpRefusal({ ...closed, invitation: "unusable" })).toBe("HOST_INVITATION_UNUSABLE");
  });

  it("lets in a sign-up that has just used a host invitation", () => {
    expect(signUpRefusal({ ...closed, invitation: "accepted" })).toBeNull();
  });

  it("lets in the first account on an empty instance, which nobody was there to give a host invitation", () => {
    expect(signUpRefusal({ ...closed, firstAccount: true })).toBeNull();
  });

  it("always lets in the email OPERATOR_EMAIL names, even with a dead host invitation", () => {
    expect(signUpRefusal({ ...closed, byOperatorEmail: true })).toBeNull();
    expect(signUpRefusal({ ...closed, byOperatorEmail: true, invitation: "unusable" })).toBeNull();
  });

  it("lets anyone in while registration is open, whatever became of their host invitation", () => {
    expect(signUpRefusal({ ...closed, mode: "open" })).toBeNull();
    expect(signUpRefusal({ ...closed, mode: "open", invitation: "unusable" })).toBeNull();
  });
});

describe("signUpNotice", () => {
  const closed = { mode: "invitationOnly", hasAccounts: true, invitation: "none" } as const;

  it("explains that a host invitation is needed while registration is invitation only", () => {
    expect(signUpNotice(closed)).toBe("invitationRequired");
  });

  it("says a host invitation can no longer be used when that is what the visitor came with", () => {
    expect(signUpNotice({ ...closed, invitation: "unusable" })).toBe("invitationUnusable");
  });

  it("welcomes a visitor with a pending host invitation, whatever the mode", () => {
    expect(signUpNotice({ ...closed, invitation: "pending" })).toBe("invitationPending");
    expect(signUpNotice({ ...closed, mode: "open", invitation: "pending" })).toBe("invitationPending");
  });

  it("asks nothing of the first account on an empty instance", () => {
    expect(signUpNotice({ ...closed, hasAccounts: false })).toBeNull();
  });

  it("says nothing about host invitations while registration is open", () => {
    expect(signUpNotice({ ...closed, mode: "open" })).toBeNull();
    expect(signUpNotice({ ...closed, mode: "open", invitation: "unusable" })).toBeNull();
  });
});

describe("isOperatorEmail", () => {
  it("matches the address OPERATOR_EMAIL names, ignoring case and surrounding spaces", () => {
    expect(isOperatorEmail("olive@example.org", "olive@example.org")).toBe(true);
    expect(isOperatorEmail("olive@example.org", "  Olive@Example.ORG ")).toBe(true);
  });

  it("matches nobody else", () => {
    expect(isOperatorEmail("mallory@example.org", "olive@example.org")).toBe(false);
  });

  it("matches nobody when OPERATOR_EMAIL is unset or blank", () => {
    expect(isOperatorEmail("olive@example.org", undefined)).toBe(false);
    expect(isOperatorEmail("", "")).toBe(false);
    expect(isOperatorEmail("", "   ")).toBe(false);
  });
});

describe("operatorEmailSeat", () => {
  const verified = { emailVerified: true };
  const unverified = { emailVerified: false };

  it("with mail, never seats an account whose email is not verified, whenever it is asked", () => {
    expect(operatorEmailSeat("account", unverified, true)).toBe("none");
    expect(operatorEmailSeat("start", unverified, true)).toBe("none");
  });

  it("with mail, seats a verified account in place of whoever is the operator", () => {
    expect(operatorEmailSeat("account", verified, true)).toBe("take");
    expect(operatorEmailSeat("start", verified, true)).toBe("take");
  });

  it("without mail, seats a new account only while nobody is the operator", () => {
    expect(operatorEmailSeat("account", unverified, false)).toBe("takeIfEmpty");
  });

  it("without mail, hands the seat over only at start, the restart the operator controls", () => {
    expect(operatorEmailSeat("start", unverified, false)).toBe("take");
  });
});
