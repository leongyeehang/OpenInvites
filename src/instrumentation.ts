// Next.js calls register() once per server instance and answers no request
// until it has completed, so migrations are applied before the first response.
// A failed migration is rethrown on every request and the container never turns healthy.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { databaseUrl } = await import("./db/client");
  const { runMigrations } = await import("./db/migrate");
  await runMigrations(databaseUrl());
}
