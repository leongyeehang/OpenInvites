// Next.js calls register() once per server instance and answers no request
// until it has completed, so migrations are applied before the first response.
// A failed migration is rethrown on every request and the container never turns healthy.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { databaseUrl } = await import("./db/client");
  const { runMigrations } = await import("./db/migrate");
  await runMigrations(databaseUrl());
  // MAX_UPLOAD_MB, retired in 0.7, is read once into Largest photo (instance/upload-limit.ts).
  const { adoptUploadLimitAtStart } = await import("./instance/upload-limit");
  await adoptUploadLimitAtStart();
  // Settings the first sign-up, upload, or legal page would otherwise trip over: fail at start instead.
  const { authSecret, baseUrl } = await import("./instance/env");
  const { mailConfig } = await import("./mail/config");
  const { storageConfig } = await import("./storage/config");
  const { checkRateLimitsAtStart } = await import("./rate-limit/rate-limit");
  const { checkLegalPagesAtStart } = await import("./legal/documents");
  const { turnstileConfig } = await import("./turnstile/config");
  baseUrl();
  authSecret();
  mailConfig();
  storageConfig();
  // Whether ffmpeg can process videos (ADR-0007); without it the site refuses videos, no more.
  const { checkFfmpegAtStart } = await import("./album/ffmpeg");
  checkFfmpegAtStart();
  checkRateLimitsAtStart();
  checkLegalPagesAtStart();
  turnstileConfig();
  // The account OPERATOR_EMAIL names becomes the operator at every start, if it exists yet and,
  // with mail, has verified its email.
  const { promoteOperatorAtStart } = await import("./instance/admission");
  await promoteOperatorAtStart();
  // The instance's clock: the retention sweep every hour, and with mail the outbox every minute.
  const { startMailWorker } = await import("./mail/worker");
  startMailWorker();
  // Items and pictures from before 0.7 have no recorded size: measured once, in the background,
  // while the site answers requests (M7 ticket 02).
  const { measureAtStart } = await import("./storage/measure");
  measureAtStart();
}
