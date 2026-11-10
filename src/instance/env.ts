// Instance-wide settings that are environment variables (spec, "Operator configuration").

// Public origin of this instance, without a trailing slash. Links in emails start with it.
export function baseUrl(): string {
  const url = process.env.BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) throw new Error("BASE_URL is not set");
  return url;
}

// The secret that signs sessions and the links in emails (AUTH_SECRET), exactly as given: trimming
// it would change the key and sign every host out. Better Auth would fall back to a built-in
// default for a missing one and only warn about a short one, so both are refused here, at start.
// The messages never hold the value.
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret?.trim()) throw new Error("AUTH_SECRET is not set");
  if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return secret;
}

// Shown wherever a host is told to contact the operator, such as password reset without mail.
export function operatorContactEmail(): string | undefined {
  return process.env.OPERATOR_CONTACT_EMAIL?.trim() || undefined;
}

// The operator's own account (OPERATOR_EMAIL): let in to sign up whatever the registration mode,
// and made the operator once it proves it holds the address, or at start (instance/admission.ts).
export function operatorEmail(): string | undefined {
  return process.env.OPERATOR_EMAIL?.trim().toLowerCase() || undefined;
}

// The operator's own analytics snippet (ANALYTICS_SNIPPET): HTML that goes into every page's head
// as given. Unset, nothing is added and nothing loads (ADR-0005).
export function analyticsSnippet(): string | undefined {
  return process.env.ANALYTICS_SNIPPET?.trim() || undefined;
}

// MAX_UPLOAD_MB, the largest picture, retired in 0.7: Largest photo on Site settings took its
// place, and instance/upload-limit.ts reads the old setting once at the first start after.

// Where the album's videos are processed (VIDEO_PROCESSING, M7 ticket 08): in the app container,
// or in a worker container started from the same image. Anything else is refused at start.
export type VideoProcessingMode = "app" | "worker";

export function videoProcessingMode(): VideoProcessingMode {
  const raw = process.env.VIDEO_PROCESSING?.trim() || "app";
  if (raw !== "app" && raw !== "worker") throw new Error(`VIDEO_PROCESSING must be "app" or "worker", not "${raw}"`);
  return raw;
}

// What this process is (VIDEO_ROLE): the app, or the worker that scripts/video-worker.mjs starts.
export function videoRole(): VideoProcessingMode {
  return process.env.VIDEO_ROLE?.trim() === "worker" ? "worker" : "app";
}

// Whether this process takes jobs from the video queue: the app does unless the processing was
// moved to a worker, and the worker always does.
export function processesVideosHere(): boolean {
  return videoRole() === "worker" || videoProcessingMode() === "app";
}
