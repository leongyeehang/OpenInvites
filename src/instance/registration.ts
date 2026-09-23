// Who may create a host account on this instance (spec, "Operator configuration"). The operator
// chooses the mode on the instance settings page; a fresh instance is invitation only.

export const REGISTRATION_MODES = ["invitationOnly", "open"] as const;

export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export const DEFAULT_REGISTRATION_MODE: RegistrationMode = "invitationOnly";

export function isRegistrationMode(value: unknown): value is RegistrationMode {
  return REGISTRATION_MODES.includes(value as RegistrationMode);
}

// What the host invitation a sign-up arrived with came to: there was none, it was used up by this
// sign-up, or it could no longer be used (used, revoked, expired, or never existed).
export type InvitationOutcome = "none" | "accepted" | "unusable";

export type SignUpFacts = {
  // The email is the one OPERATOR_EMAIL names: the operator's way back in, in any mode.
  byOperatorEmail: boolean;
  // This sign-up found the instance empty and took it: nobody was there to give it a host invitation.
  firstAccount: boolean;
  mode: RegistrationMode;
  invitation: InvitationOutcome;
};

export type SignUpRefusal = "HOST_INVITATION_REQUIRED" | "HOST_INVITATION_UNUSABLE";

// Why a new host is turned away, or null to let them in. Every way of signing up (email, Google,
// GitHub) comes through here, from the one place Better Auth creates a host (auth/auth.ts).
export function signUpRefusal(facts: SignUpFacts): SignUpRefusal | null {
  if (facts.byOperatorEmail || facts.firstAccount || facts.mode === "open" || facts.invitation === "accepted") return null;
  return facts.invitation === "unusable" ? "HOST_INVITATION_UNUSABLE" : "HOST_INVITATION_REQUIRED";
}

export type SignUpNotice = "invitationPending" | "invitationUnusable" | "invitationRequired";

// What the sign-up page tells a visitor before they try, given the host invitation this browser
// was given, if any. It never promises what signUpRefusal would not keep: an empty instance takes
// its first account without an invitation, so it asks for none.
export function signUpNotice(facts: {
  mode: RegistrationMode;
  hasAccounts: boolean;
  invitation: "none" | "pending" | "unusable";
}): SignUpNotice | null {
  if (facts.invitation === "pending") return "invitationPending";
  if (facts.mode === "open" || !facts.hasAccounts) return null;
  return facts.invitation === "unusable" ? "invitationUnusable" : "invitationRequired";
}

function normalizedEmail(email: string | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

// Whether an email is the one OPERATOR_EMAIL names. Unset or blank names nobody.
export function isOperatorEmail(email: string, setting: string | undefined): boolean {
  const operator = normalizedEmail(setting);
  return operator !== "" && normalizedEmail(email) === operator;
}
