/**
 * Read-only SQL against DATABASE_URL, printed as a table: for checking a claim against real data
 * without writing a one-off script. Runs in a read-only transaction with a 30 s statement
 * timeout, and prints at most 200 rows.
 *
 * `raw`/`timeline` are compressed bytea and print as buffers: use match-json for those.
 *
 * Usage: pnpm --filter @arena/db query "select count(*) from matches"
 */
import postgres from "postgres";

const MAX_ROWS = 200;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const text = process.argv.slice(2).join(" ").trim();
if (!text) throw new Error('Usage: pnpm --filter @arena/db query "<sql>"');

const sql = postgres(DATABASE_URL, { max: 1, connection: { statement_timeout: 30_000 } });
try {
  const rows = await sql.begin("read only", (tx) => tx.unsafe(text));
  console.table(rows.slice(0, MAX_ROWS));
  console.log(rows.length > MAX_ROWS ? `${rows.length} rows, first ${MAX_ROWS} shown` : `${rows.length} rows`);
} finally {
  await sql.end();
}
