import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { ArchiveDb, Db } from "./client.js";

// The generated SQL, found relative to this file so it works whichever
// package calls it. Bundled into an app (apps/api/dist/index.mjs), this code
// lives in the bundle, and the build copies the SQL next to it (dist/drizzle);
// run from source, it's packages/db/src/migrate.ts and the SQL is in
// packages/db/drizzle.
// The archive database's are in drizzle-archive, found the same way.
function migrationsFolder(name: string) {
  return [new URL(`./${name}`, import.meta.url), new URL(`../${name}`, import.meta.url)]
    .map((url) => fileURLToPath(url))
    .find((folder) => existsSync(folder));
}

/**
 * Applies any migration not yet recorded in the database, the same way
 * `drizzle-kit migrate` does (same `drizzle.__drizzle_migrations` table, so
 * the two can be mixed). The API runs it at startup, which is how a deploy
 * gets its schema: drizzle-kit is a dev-only tool.
 */
export async function runMigrations(db: Db) {
  const folder = migrationsFolder("drizzle");
  if (!folder) throw new Error("Migrations folder not found (packages/db/drizzle, or drizzle/ next to a bundle)");
  await migrate(db, { migrationsFolder: folder });
}

/** The archive database's migrations (`archiveSchema.ts`), from drizzle-archive. */
export async function runArchiveMigrations(db: ArchiveDb) {
  const folder = migrationsFolder("drizzle-archive");
  if (!folder) {
    throw new Error("Migrations folder not found (packages/db/drizzle-archive, or drizzle-archive/ next to a bundle)");
  }
  await migrate(db, { migrationsFolder: folder });
}
