/**
 * One-off maintenance script: fetches the timeline for every match that
 * doesn't have one stored yet (matches ingested before timeline fetching
 * was added — see CLAUDE.md §2) and writes it into matches.timeline.
 *
 * This is the one gap the packages/db backfill scripts can't close on
 * their own: they can only re-derive stats from what's *already* stored,
 * and these matches' timelines were never fetched from Riot at all.
 *
 * After this runs, re-run `pnpm --filter @arena/db
 * backfill-reparse-participants` to compute anvilsBought (and re-check
 * everything else) for these matches now that their timeline exists.
 *
 * Usage: pnpm --filter @arena/api exec tsx --env-file=.env scripts/backfill-missing-timelines.ts
 */
import { eq, isNull, matches, compressJson } from "@arena/db";
import { db } from "../src/db.js";
import { riot } from "../src/riotApi/index.js";

async function main() {
  const missing = await db
    .select({ matchId: matches.matchId })
    .from(matches)
    .where(isNull(matches.timeline));

  console.log(`Fetching timelines for ${missing.length} matches...`);

  let done = 0;
  for (const m of missing) {
    const timelineDto = await riot.match.getMatchTimeline(m.matchId);
    await db
      .update(matches)
      .set({ timeline: compressJson(timelineDto) })
      .where(eq(matches.matchId, m.matchId));
    done++;
    console.log(`  [${done}/${missing.length}] ${m.matchId}`);
  }

  console.log(`Done. Now run: pnpm --filter @arena/db backfill-reparse-participants`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
