import { inArray, matches, matchParticipants, parseMatch, type Db } from "@arena/db";
import type { RiotClient } from "../riot/client.js";

/**
 * Pulls new Arena matches for one tracked summoner: fetches recent match
 * ids, skips ones already in the DB, fetches + parses the rest, and
 * inserts them. Safe to call repeatedly (e.g. from the poll loop) —
 * already-ingested matches are cheap no-ops.
 */
export async function ingestSummoner(
  db: Db,
  riot: RiotClient,
  summoner: { puuid: string; region: string },
) {
  const recentMatchIds = await riot.getArenaMatchIdsByPuuid(summoner.puuid, summoner.region);
  if (recentMatchIds.length === 0) return { ingested: 0 };

  const existing = await db
    .select({ matchId: matches.matchId })
    .from(matches)
    .where(inArray(matches.matchId, recentMatchIds));
  const existingIds = new Set(existing.map((m) => m.matchId));

  const newMatchIds = recentMatchIds.filter((id) => !existingIds.has(id));

  let ingested = 0;
  for (const matchId of newMatchIds) {
    const dto = await riot.getMatch(matchId, summoner.region);
    const timelineDto = await riot.getMatchTimeline(matchId, summoner.region);
    const { match, participants } = parseMatch(matchId, summoner.region, dto, timelineDto);

    await db.transaction(async (tx) => {
      await tx.insert(matches).values(match).onConflictDoNothing({ target: matches.matchId });
      await tx.insert(matchParticipants).values(participants).onConflictDoNothing();
    });
    ingested += 1;
  }

  return { ingested };
}

export async function ingestAllTrackedSummoners(
  db: Db,
  riot: RiotClient,
  summoners: Array<{ puuid: string; region: string }>,
) {
  const results = [];
  for (const summoner of summoners) {
    try {
      results.push({ puuid: summoner.puuid, ...(await ingestSummoner(db, riot, summoner)) });
    } catch (err) {
      results.push({ puuid: summoner.puuid, error: err instanceof Error ? err.message : err });
    }
  }
  return results;
}
