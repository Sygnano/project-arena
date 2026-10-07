/**
 * One-off maintenance script: rebuilds `matches.rounds` for every match with
 * an archived timeline, from the archive database's `raw`/`timeline` blobs — no
 * Riot API calls. Run after changing `parseRounds()`.
 *
 * Safe to re-run: each match's rounds are replaced whole.
 *
 * Usage: pnpm --filter @arena/db backfill-rounds
 */

import type { RiotArenaMatchDto, RiotMatchTimelineDto } from "@arena/types";
import { eq } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { decompressJson } from "../src/compression.js";
import { parseRounds, roundsColumn } from "../src/parseRounds.js";
import { matches } from "../src/schema.js";
import { archivedMatchBatches, connectArchive } from "./archived-matches.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

async function main() {
  const db = createDb(DATABASE_URL!);
  const archive = connectArchive(DATABASE_URL!);

  console.log("Rebuilding rounds for every archived match with a timeline...");

  let duels = 0;
  let matchCount = 0;
  for await (const batch of archivedMatchBatches(archive))
    for (const row of batch) {
      if (!row.timeline) continue;
      matchCount++;
      const dto = decompressJson<RiotArenaMatchDto>(row.raw);
      const timelineDto = decompressJson<RiotMatchTimelineDto>(row.timeline);
      const rounds = parseRounds(row.matchId, dto, timelineDto);
      duels += rounds.length;

      await db
        .update(matches)
        .set({ rounds: roundsColumn(rounds) })
        .where(eq(matches.matchId, row.matchId));
    }

  console.log(`Done: ${duels} duels across ${matchCount} matches.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
