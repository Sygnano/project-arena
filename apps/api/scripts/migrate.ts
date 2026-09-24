/**
 * Applies pending database migrations, then exits: the API service's Railway
 * pre-deploy command (`node --enable-source-maps apps/api/dist/scripts/migrate.mjs`),
 * run after the build and before the new container starts, outside the
 * health check's window. A migration that rewrites a big table takes minutes
 * (0020 on match_participants); run at API startup, it outlasted the health
 * check, the container was killed and the migration rolled back, deploy
 * after deploy.
 *
 * While a rewrite runs it holds its table's lock: queries on that table
 * (recap reads) wait until it's done. Stop the crawler and cron first, so the
 * lock is free (see LOCK_TIMEOUT_MS in src/migrations.ts).
 *
 *   pnpm --filter @arena/api build:scripts && node --env-file=apps/api/.env apps/api/dist/scripts/migrate.mjs
 *     locally, though `pnpm dev` migrates at startup anyway
 */
import { logger } from "../src/logger.js";
import { applyMigrations } from "../src/migrations.js";

const log = logger.child({ module: "migrate" });
const startedAt = performance.now();
log.info("applying pending migrations");
try {
  await applyMigrations();
  log.info({ seconds: Math.round((performance.now() - startedAt) / 1000) }, "migrations applied");
} catch (err) {
  log.error({ err }, "migrations failed, nothing applied");
  process.exit(1);
}
