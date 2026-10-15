// Next.js calls register() once per server instance and answers no request
// until it has completed, so migrations are applied before the first response.
// A failed migration is rethrown on every request and the container never turns healthy.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { databaseUrl } = await import("./db/client");
  const { runMigrations } = await import("./db/migrate");
  await runMigrations(databaseUrl());
  // Settings the first sign-up, upload, or legal page would otherwise trip over: fail at start instead.
  const { authSecret, baseUrl, maxUploadBytes } = await import("./instance/env");
  const { mailConfig } = await import("./mail/config");
  const { storageConfig } = await import("./storage/config");
  const { checkRateLimitsAtStart } = await import("./rate-limit/rate-limit");
  const { checkLegalPagesAtStart } = await import("./legal/documents");
  baseUrl();
  authSecret();
  mailConfig();
  storageConfig();
  maxUploadBytes();
  checkRateLimitsAtStart();
  checkLegalPagesAtStart();
  // The account OPERATOR_EMAIL names becomes the operator at every start, if it exists yet and,
  // with mail, has verified its email.
  const { promoteOperatorAtStart } = await import("./instance/admission");
  await promoteOperatorAtStart();
  // Mail about events goes out from the outbox every minute, when the instance has mail.
  const { startMailWorker } = await import("./mail/worker");
  startMailWorker();
}
