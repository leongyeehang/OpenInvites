import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// The database, or a transaction on it: what a query takes that may run inside its caller's
// transaction.
export type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

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
