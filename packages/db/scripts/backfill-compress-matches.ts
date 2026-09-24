/**
 * One-off maintenance script: recompresses `matches.raw`/`matches.timeline`
 * rows that are still holding uncompressed JSON text bytes (bytea, but not
 * brotli — e.g. rows carried over by the jsonb->bytea migration, which can
 * only cast through text, not compress). New rows written by the app are
 * already compressed via compressJson() at insert time; this is for
 * catching up existing data after a migration like that one.
 *
 * Safe to re-run: it detects already-brotli-compressed rows (by checking
 * the brotli stream header) and skips them.
 *
 * Usage: DATABASE_URL=... pnpm --filter @arena/db exec tsx scripts/backfill-compress-matches.ts
 */
import postgres from "postgres";
import { compressJson } from "../src/compression.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

// Brotli streams don't have a fixed magic number, but the encoder always
// emits a specific first byte for these payload sizes in practice — instead
// of relying on that, we just try JSON.parse on the raw bytes as UTF-8: an
// already-brotli-compressed buffer won't parse as JSON text, so anything
// that DOES parse as JSON here is still in the uncompressed intermediate
// form the migration left behind.
function isUncompressedJsonText(buf: Buffer): boolean {
  try {
    JSON.parse(buf.toString("utf-8"));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sql = postgres(DATABASE_URL!);

  const rows = await sql<{ match_id: string; raw: Buffer; timeline: Buffer | null }[]>`
    select match_id, raw, timeline from matches
  `;

  let recompressed = 0;
  let skipped = 0;

  for (const row of rows) {
    const rawNeedsWork = isUncompressedJsonText(row.raw);
    const timelineNeedsWork = row.timeline !== null && isUncompressedJsonText(row.timeline);

    if (!rawNeedsWork && !timelineNeedsWork) {
      skipped++;
      continue;
    }

    const newRaw = rawNeedsWork ? await compressJson(JSON.parse(row.raw.toString("utf-8"))) : row.raw;
    const newTimeline =
      timelineNeedsWork && row.timeline ? await compressJson(JSON.parse(row.timeline.toString("utf-8"))) : row.timeline;

    await sql`update matches set raw = ${newRaw}, timeline = ${newTimeline} where match_id = ${row.match_id}`;
    recompressed++;
    if (recompressed % 25 === 0) console.log(`  recompressed ${recompressed}...`);
  }

  console.log(`Done. Recompressed ${recompressed}, already-compressed ${skipped}.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
