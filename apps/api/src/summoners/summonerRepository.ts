import { and, eq, ilike, matches, matchParticipants, sql, summoners, type Summoner } from "@arena/db";
import type { RiotAccountDto, RiotSummonerDto, SummonerView } from "@arena/types";
import { db } from "../db.js";

/** `ilike` is case-insensitive, but `%` and `_` in a hand-typed URL would act
 * as wildcards and could match someone else (Riot IDs may contain `_`). */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Case-insensitive: Riot IDs get typed and shared by hand. */
export async function findSummonerByRiotId(region: string, gameName: string, tagLine: string) {
  const [summoner] = await db
    .select()
    .from(summoners)
    .where(
      and(
        ilike(summoners.region, escapeLike(region)),
        ilike(summoners.riotIdGameName, escapeLike(gameName)),
        ilike(summoners.riotIdTagline, escapeLike(tagLine)),
      ),
    );
  return summoner as Summoner | undefined;
}

export async function findSummonerByPuuid(puuid: string) {
  const [summoner] = await db.select().from(summoners).where(eq(summoners.puuid, puuid));
  return summoner as Summoner | undefined;
}

/**
 * How many games a summoner's recap covers and when the latest started: one
 * indexed count. It changes exactly when their recap would, which makes it
 * the stats cache's key (any refresh, theirs or a teammate's, that stores
 * one of their games moves it). Placement-0 games are left out, as in the
 * recap itself (see `loadStatsData`).
 */
export async function getMatchSummary(puuid: string) {
  const [row] = await db
    .select({
      matchCount: sql<number>`count(*)::int`,
      lastGameAt: sql<string | null>`max(${matches.gameCreation})::text`,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.matchId))
    .where(and(eq(matchParticipants.puuid, puuid), sql`${matchParticipants.placement} > 0`));
  return row!;
}

export function toSummonerView(summoner: Summoner, matchCount: number): SummonerView {
  return {
    region: summoner.region,
    gameName: summoner.riotIdGameName,
    tagLine: summoner.riotIdTagline,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    lastRefreshedAt: summoner.lastRefreshedAt?.toISOString() ?? null,
    matchCount,
  };
}

/**
 * Stores what Riot says about a player (their current Riot ID, icon and
 * level), adding them if they're new. Account-V1 is the only source of a
 * current Riot ID: match data can predate a rename.
 */
export async function saveSummonerFromRiot(region: string, account: RiotAccountDto, profile: RiotSummonerDto) {
  const fields = {
    riotIdGameName: account.gameName,
    riotIdTagline: account.tagLine,
    profileIconId: profile.profileIconId,
    summonerLevel: profile.summonerLevel,
  };
  const [summoner] = await db
    .insert(summoners)
    .values({ puuid: account.puuid, region, ...fields })
    .onConflictDoUpdate({ target: summoners.puuid, set: fields })
    .returning();
  return summoner!;
}
