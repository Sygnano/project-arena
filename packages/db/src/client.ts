import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as archiveSchema from "./archiveSchema.js";
import * as schema from "./schema.js";

export interface DbOptions {
  /** Postgres `statement_timeout`: a query running longer is cancelled
   * (error 57014). Unset: no limit, Postgres's default. */
  statementTimeoutMs?: number;
  /** Postgres `idle_in_transaction_session_timeout`: a session left idle
   * inside a transaction this long is closed, releasing its locks. */
  idleInTransactionTimeoutMs?: number;
  /** Postgres `lock_timeout`: a statement waiting this long for a lock is
   * cancelled (error 55P03) instead of waiting on, and holding up everything
   * queued behind it on that table. */
  lockTimeoutMs?: number;
}

function connect(connectionString: string, options: DbOptions) {
  return postgres(connectionString, {
    // postgres.js prints every server notice to the console as a multi-line
    // object, outside the JSON logs. The only ones sent are the migrator's
    // "schema/table already exists, skipping" at each startup.
    onnotice: () => {},
    // Sent with each new connection, so every session gets them.
    connection: {
      ...(options.statementTimeoutMs !== undefined ? { statement_timeout: options.statementTimeoutMs } : {}),
      ...(options.idleInTransactionTimeoutMs !== undefined
        ? { idle_in_transaction_session_timeout: options.idleInTransactionTimeoutMs }
        : {}),
      ...(options.lockTimeoutMs !== undefined ? { lock_timeout: options.lockTimeoutMs } : {}),
    },
  });
}

export function createDb(connectionString: string, options: DbOptions = {}) {
  return drizzle(connect(connectionString, options), { schema });
}

/** ARCHIVE_DATABASE_URL, else DATABASE_URL with its database renamed `arena_archive`: the
 * local setup, one server and one role for both databases. */
export function archiveDatabaseUrl(databaseUrl: string, archiveUrl?: string): string {
  if (archiveUrl) return archiveUrl;
  const url = new URL(databaseUrl);
  url.pathname = "/arena_archive";
  return url.toString();
}

/** The archive database: Riot's payloads, see `archiveSchema.ts`. */
export function createArchiveDb(connectionString: string, options: DbOptions = {}) {
  return drizzle(connect(connectionString, options), { schema: archiveSchema });
}

export type Db = ReturnType<typeof createDb>;
export type ArchiveDb = ReturnType<typeof createArchiveDb>;
