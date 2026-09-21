// Next.js calls register() once per server start and waits for it before
// serving any request, so migrations are applied before the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { databaseUrl } = await import("./db/client");
  const { runMigrations } = await import("./db/migrate");
  await runMigrations(databaseUrl());
}
