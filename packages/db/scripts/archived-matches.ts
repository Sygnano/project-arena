import { asc, gt } from "drizzle-orm";
import { archivedMatches } from "../src/archiveSchema.js";
import { type ArchiveDb, archiveDatabaseUrl, createArchiveDb } from "../src/client.js";

/** The archive database the backfills read, from the same env as `DATABASE_URL`. */
export function connectArchive(databaseUrl: string): ArchiveDb {
  return createArchiveDb(archiveDatabaseUrl(databaseUrl, process.env.ARCHIVE_DATABASE_URL));
}

/** Every archived match in `match_id` order, a batch at a time: the archive (tens of GB) is far
 * too big to load at once. */
export async function* archivedMatchBatches(archive: ArchiveDb, batchSize = 200) {
  let after = "";
  for (;;) {
    const rows = await archive
      .select()
      .from(archivedMatches)
      .where(gt(archivedMatches.matchId, after))
      .orderBy(asc(archivedMatches.matchId))
      .limit(batchSize);
    if (rows.length === 0) return;
    yield rows;
    after = rows[rows.length - 1]!.matchId;
  }
}
