import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client.js";

// The generated SQL in packages/db/drizzle, found relative to this file so
// it works whichever package calls it.
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Applies any migration not yet recorded in the database, the same way
 * `drizzle-kit migrate` does (same `drizzle.__drizzle_migrations` table, so
 * the two can be mixed). The API runs it at startup, which is how a deploy
 * gets its schema: drizzle-kit is a dev-only tool.
 */
export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
