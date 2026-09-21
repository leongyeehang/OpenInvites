// Instance-wide settings that are environment variables (spec, "Operator configuration").

// Public origin of this instance, without a trailing slash. Links in emails start with it.
export function baseUrl(): string {
  const url = process.env.BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) throw new Error("BASE_URL is not set");
  return url;
}

// Shown wherever a host is told to contact the operator, such as password reset without mail.
export function operatorContactEmail(): string | undefined {
  return process.env.OPERATOR_CONTACT_EMAIL?.trim() || undefined;
}
