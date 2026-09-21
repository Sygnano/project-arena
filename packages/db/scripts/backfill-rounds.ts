/**
 * One-off maintenance script: rebuilds `match_rounds` for every match with
 * a stored timeline, from the already-stored `raw`/`timeline` blobs — no
 * Riot API calls. Run after changing `parseRounds()`.
 *
 * Safe to re-run: each match's rows are deleted and re-inserted together.
 *
 * Usage: pnpm --filter @arena/db backfill-rounds
 */
import { eq, isNotNull } from "drizzle-orm";
import type { RiotArenaMatchDto, RiotMatchTimelineDto } from "@arena/types";
import { createDb } from "../src/client.js";
import { matches, matchRounds } from "../src/schema.js";
import { decompressJson } from "../src/compression.js";
import { parseRounds } from "../src/parseRounds.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

async function main() {
  const db = createDb(DATABASE_URL!);

  const rows = await db
    .select({ matchId: matches.matchId, raw: matches.raw, timeline: matches.timeline })
    .from(matches)
    .where(isNotNull(matches.timeline));

  console.log(`Rebuilding rounds for ${rows.length} matches...`);

  let duels = 0;
  for (const row of rows) {
    const dto = decompressJson<RiotArenaMatchDto>(row.raw);
    const timelineDto = decompressJson<RiotMatchTimelineDto>(row.timeline!);
    const rounds = parseRounds(row.matchId, dto, timelineDto);
    duels += rounds.length;

    await db.transaction(async (tx) => {
      await tx.delete(matchRounds).where(eq(matchRounds.matchId, row.matchId));
      if (rounds.length > 0) await tx.insert(matchRounds).values(rounds);
    });
  }

  console.log(`Done: ${duels} duels across ${rows.length} matches.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
