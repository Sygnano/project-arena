import { createDb, runMigrations } from "@arena/db";
import { env } from "./env.js";

// A migration that can't get its table's lock within this long fails
// instead of waiting: while it waits, every query on that table queues behind
// it, the live site's recap reads included. Stop the crawler and cron
// (whose open transactions hold those locks) and deploy again.
const LOCK_TIMEOUT_MS = 30_000;

/**
 * Applies pending migrations on a connection of their own: through
 * MIGRATION_DATABASE_URL (a DDL-capable role) when set, so the role serving
 * requests needs no rights beyond reading and writing rows, else
 * DATABASE_URL. No statement timeout, unlike the app's connection: a
 * migration that rewrites a table (0020 on match_participants) runs for
 * minutes. In production they run in the Railway pre-deploy command
 * (scripts/migrate.ts), before the new container starts; the API's own call
 * at startup then finds nothing to do.
 */
export async function applyMigrations() {
  const migrationDb = createDb(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, { lockTimeoutMs: LOCK_TIMEOUT_MS });
  try {
    await runMigrations(migrationDb);
  } finally {
    await migrationDb.$client.end({ timeout: 5 });
  }
}
