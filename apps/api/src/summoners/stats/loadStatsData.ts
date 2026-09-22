import { and, asc, eq, inArray, matches, matchParticipants, matchRounds, sql, type MatchParticipant } from "@arena/db";
import { db } from "../../db.js";

/** One of the summoner's own games: their `match_participants` row plus the
 * two `matches` fields the stats read. */
export type OwnGame = MatchParticipant & {
  gameCreation: Date;
  bannedChampionIds: number[] | null;
};

/** Anyone (the summoner included) who played in one of the summoner's games. */
export type CoParticipant = Pick<
  MatchParticipant,
  "matchId" | "puuid" | "teamId" | "placement" | "championId" | "championName" | "riotIdGameName" | "riotIdTagline"
>;

/** One duel of one of the summoner's games (see `parseRounds`). */
export type Round = { matchId: string; winnerTeamId: number; loserTeamId: number };

export interface StatsData {
  /** Oldest first. */
  games: OwnGame[];
  /** Every participant of those games, grouped by match. */
  participantsByMatch: Map<string, CoParticipant[]>;
  /** Every duel of those games, grouped by match. */
  roundsByMatch: Map<string, Round[]>;
}

function groupByMatch<T extends { matchId: string }>(rows: readonly T[]): Map<string, T[]> {
  const byMatch = new Map<string, T[]>();
  for (const row of rows) {
    const list = byMatch.get(row.matchId);
    if (list) list.push(row);
    else byMatch.set(row.matchId, [row]);
  }
  return byMatch;
}

/**
 * Everything a recap is built from, in three queries run together: the
 * summoner's games, everyone in them, and their duels. Every stat is then
 * computed in memory from these rows (a few thousand at most), instead of one
 * aggregate query per stat.
 */
export async function loadStatsData(puuid: string): Promise<StatsData> {
  // Placement 0 marks a broken lobby: all 18 players on one team, no result,
  // usually over within two minutes (16 such matches seen). It isn't a game
  // the summoner won or lost, so it stays out of the recap.
  const ownGame = and(eq(matchParticipants.puuid, puuid), sql`${matchParticipants.placement} > 0`);
  const ownMatchIds = db.select({ matchId: matchParticipants.matchId }).from(matchParticipants).where(ownGame);

  const [games, participants, rounds] = await Promise.all([
    db
      .select({
        participant: matchParticipants,
        gameCreation: matches.gameCreation,
        bannedChampionIds: matches.bannedChampionIds,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
      .where(ownGame)
      .orderBy(asc(matches.gameCreation)),
    db
      .select({
        matchId: matchParticipants.matchId,
        puuid: matchParticipants.puuid,
        teamId: matchParticipants.teamId,
        placement: matchParticipants.placement,
        championId: matchParticipants.championId,
        championName: matchParticipants.championName,
        riotIdGameName: matchParticipants.riotIdGameName,
        riotIdTagline: matchParticipants.riotIdTagline,
      })
      .from(matchParticipants)
      .where(inArray(matchParticipants.matchId, ownMatchIds)),
    db
      .select({
        matchId: matchRounds.matchId,
        winnerTeamId: matchRounds.winnerTeamId,
        loserTeamId: matchRounds.loserTeamId,
      })
      .from(matchRounds)
      .where(inArray(matchRounds.matchId, ownMatchIds)),
  ]);

  return {
    games: games.map((row) => ({
      ...row.participant,
      gameCreation: row.gameCreation,
      bannedChampionIds: row.bannedChampionIds,
    })),
    participantsByMatch: groupByMatch(participants),
    roundsByMatch: groupByMatch(rounds),
  };
}
