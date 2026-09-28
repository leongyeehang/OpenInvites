import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Any fixed number will do, as long as nothing else on the database takes the same advisory lock.
const MIGRATION_LOCK = 7_263_149_042;

// Applies every pending migration in ./drizzle. Uses its own single connection
// and closes it afterwards, as the Drizzle migrator recommends. Postgres NOTICE
// messages ("already exists, skipping") are routine on every start, so they are not logged.
// Containers that start together on one database, such as during a rolling upgrade, take
// turns under an advisory lock: otherwise both create the migrator's own table at once
// and the loser fails its start.
export async function runMigrations(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK})`;
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    // Closing the connection releases the lock too.
    await client.end();
  }
}
