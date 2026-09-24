import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export interface DbOptions {
  /** Postgres `statement_timeout`: a query running longer is cancelled
   * (error 57014). Unset: no limit, Postgres's default. */
  statementTimeoutMs?: number;
  /** Postgres `idle_in_transaction_session_timeout`: a session left idle
   * inside a transaction this long is closed, releasing its locks. */
  idleInTransactionTimeoutMs?: number;
}

export function createDb(connectionString: string, options: DbOptions = {}) {
  const client = postgres(connectionString, {
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
    },
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
