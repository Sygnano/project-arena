import { customType, pgTable, text } from "drizzle-orm/pg-core";

// Drizzle's pg-core has no built-in `bytea` helper — postgres.js already
// marshals bytea <-> Buffer natively, so this just tells Drizzle the SQL
// type name. Used for compressed JSON blobs (see compression.ts) — plain
// binary data, not something queried with jsonb operators.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * The archive database (ARCHIVE_DATABASE_URL), apart from the one pages read:
 * Riot's full payloads for every stored match, from which any parsed column
 * can be re-derived without calling Riot again (the backfill scripts). Pages
 * never read it.
 *
 * `raw` (Match-V5) and `timeline` are brotli-compressed JSON (bytea), not
 * jsonb: measured on real Arena payloads, app-level brotli is ~13-22x smaller
 * than Postgres's TOAST compression of the same jsonb (a ~1.3 MB timeline
 * stores in ~65-100 KB). They're always read whole and parsed in code. Write
 * with `compressJson`, read with `decompressJson` (`./compression.js`).
 */
export const archivedMatches = pgTable("matches", {
  matchId: text("match_id").primaryKey(),
  raw: bytea("raw").notNull(),
  // Null for the handful of matches ingested before timelines were fetched.
  timeline: bytea("timeline"),
});

export type ArchivedMatch = typeof archivedMatches.$inferSelect;
