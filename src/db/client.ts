import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

// Connected on first use, not at import: `next build` loads route modules with
// no database configured. Cached on globalThis so development reloads reuse one pool.
const globalForDb = globalThis as unknown as { openinvitesDb?: PostgresJsDatabase<typeof schema> };

export function getDb(): PostgresJsDatabase<typeof schema> {
  globalForDb.openinvitesDb ??= drizzle(postgres(databaseUrl()), { schema });
  return globalForDb.openinvitesDb;
}
