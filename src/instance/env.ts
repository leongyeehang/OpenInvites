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

// The account that is the operator (OPERATOR_EMAIL): promoted at start if it exists, let in
// whatever the registration mode, and made the operator the moment it is created. The operator's
// way back in, should someone else have created the first account on a fresh instance.
export function operatorEmail(): string | undefined {
  return process.env.OPERATOR_EMAIL?.trim().toLowerCase() || undefined;
}

const MEGABYTE = 1024 * 1024;

// The largest picture a host may upload, in megabytes (MAX_UPLOAD_MB, default 10).
export function maxUploadBytes(): number {
  const setting = process.env.MAX_UPLOAD_MB?.trim();
  if (!setting) return 10 * MEGABYTE;
  const megabytes = Number(setting);
  if (!Number.isFinite(megabytes) || megabytes <= 0) throw new Error(`MAX_UPLOAD_MB must be a number of megabytes, not "${setting}"`);
  return Math.floor(megabytes * MEGABYTE);
}
