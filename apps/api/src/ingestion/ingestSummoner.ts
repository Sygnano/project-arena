import { eq, inArray, matches, matchParticipants, matchRounds, parseMatch, parseRounds, summoners, type Db } from "@arena/db";
import type { RiotArenaMatchDto } from "@arena/types";
import type { RiotClient } from "../riotApi/client.js";
import { Queue } from "../riotApi/queues.js";

export type IngestProgress =
  | { phase: "matchIds" }
  | { phase: "matches"; done: number; total: number };

export interface IngestOptions {
  /** Checked between matches: returning true stops the refresh early,
   * WITHOUT stamping `lastRefreshedAt`, so the next run resumes it (matches
   * already stored are skipped). Used by the crawler's Ctrl-C handling. */
  shouldStop?: () => boolean;
}

// A refresh only asks Riot for games that started after the previous
// refresh, minus this margin: a game still being played (or not yet
// published by Riot) when the last refresh ran started before its stamp.
// Arena games last well under an hour.
const REFRESH_OVERLAP_MS = 2 * 60 * 60_000;

/** `summoners` rows for everyone in this match, as of this match. */
function participantSummoners(dto: RiotArenaMatchDto, region: string) {
  return dto.info.participants
    .filter((p) => p.riotIdGameName && p.riotIdTagline)
    .map((p) => ({
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      region,
      profileIconId: p.profileIcon ?? null,
      summonerLevel: p.summonerLevel ?? null,
    }));
}

/**
 * Pulls new Arena matches for one summoner: fetches their match ids (only
 * since the last refresh, when there was one), skips ones already in the DB
 * — matches are shared between players, so each is stored once no matter
 * how many of its players get refreshed — fetches + parses the rest, and
 * inserts them.
 *
 * Every participant of a newly stored match is added to `summoners` if
 * they aren't there yet (with `lastRefreshedAt` null, i.e. "never
 * refreshed"), which is how the crawler discovers new players. Existing
 * rows are never overwritten from match data: a match's Riot ID can predate
 * a rename, and account-v1 is what keeps names current (POST
 * /summoners/lookup, and the crawler before each summoner). Stamps `summoners.lastRefreshedAt` on success.
 *
 * Safe to call repeatedly — an interrupted refresh resumes where it stopped.
 */
export async function ingestSummoner(
  db: Db,
  riot: RiotClient,
  summoner: { puuid: string; region: string },
  onProgress?: (progress: IngestProgress) => void,
  options: IngestOptions = {},
) {
  const startedAt = new Date();
  const [previous] = await db
    .select({ lastRefreshedAt: summoners.lastRefreshedAt })
    .from(summoners)
    .where(eq(summoners.puuid, summoner.puuid));
  const since = previous?.lastRefreshedAt
    ? new Date(previous.lastRefreshedAt.getTime() - REFRESH_OVERLAP_MS)
    : undefined;

  onProgress?.({ phase: "matchIds" });
  // Newest first.
  const recentMatchIds = await riot.match.getAllMatchIdsByPuuid(summoner.puuid, summoner.region, {
    queue: Queue.ARENA,
    startTime: since,
  });

  const existing =
    recentMatchIds.length === 0
      ? []
      : await db
          .select({ matchId: matches.matchId })
          .from(matches)
          .where(inArray(matches.matchId, recentMatchIds));
  const existingIds = new Set(existing.map((m) => m.matchId));

  const newMatchIds = recentMatchIds.filter((id) => !existingIds.has(id));

  let ingested = 0;
  let discovered = 0;
  onProgress?.({ phase: "matches", done: 0, total: newMatchIds.length });
  for (const matchId of newMatchIds) {
    if (options.shouldStop?.()) return { ingested, discovered, stopped: true };

    const dto = await riot.match.getMatch(matchId);
    const timelineDto = await riot.match.getMatchTimeline(matchId);
    const { match, participants } = parseMatch(matchId, summoner.region, dto, timelineDto);
    const rounds = timelineDto ? parseRounds(matchId, dto, timelineDto) : [];
    const players = participantSummoners(dto, summoner.region);

    await db.transaction(async (tx) => {
      await tx.insert(matches).values(match).onConflictDoNothing({ target: matches.matchId });
      await tx.insert(matchParticipants).values(participants).onConflictDoNothing();
      if (rounds.length > 0) await tx.insert(matchRounds).values(rounds).onConflictDoNothing();
      if (players.length > 0) {
        const inserted = await tx
          .insert(summoners)
          .values(players)
          .onConflictDoNothing({ target: summoners.puuid })
          .returning({ puuid: summoners.puuid });
        discovered += inserted.length;
      }
    });
    ingested += 1;
    onProgress?.({ phase: "matches", done: ingested, total: newMatchIds.length });
  }

  await db
    .update(summoners)
    // The refresh's start, not its end: games that began while it ran are
    // picked up next time (plus REFRESH_OVERLAP_MS on top).
    .set({ lastRefreshedAt: startedAt })
    .where(eq(summoners.puuid, summoner.puuid));

  return { ingested, discovered, stopped: false };
}
