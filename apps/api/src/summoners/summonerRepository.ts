import {
  and,
  eq,
  matches,
  matchParticipants,
  riotIdColumns,
  riotIdKey,
  sql,
  summoners,
  type Summoner,
} from "@arena/db";
import type { RiotAccountDto, RiotSummonerDto, SummonerView } from "@arena/types";
import { db } from "../db.js";

/**
 * Case- and whitespace-insensitive (Riot IDs get typed and shared by hand),
 * by `riot_id_key` through `summoners_riot_id_idx`. Two rows can hold one Riot ID, since a player discovered in a
 * match keeps that match's name until refreshed and someone else may have
 * taken it since: the most recently refreshed row, whose name account-v1
 * confirmed, wins.
 */
export async function findSummonerByRiotId(region: string, gameName: string, tagLine: string) {
  const [summoner] = await db
    .select()
    .from(summoners)
    .where(and(eq(summoners.region, region.toLowerCase()), eq(summoners.riotIdKey, riotIdKey(gameName, tagLine))))
    .orderBy(sql`${summoners.lastRefreshedAt} desc nulls last`)
    .limit(1);
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
 * level), adding them if they're new. The only writer of these fields from
 * Riot's profile APIs (callers: `ingestion/resolveSummoner.ts`); ingestion
 * only inserts players it hasn't seen, never overwrites. Account-V1 is the
 * only source of a current Riot ID: match data can predate a rename.
 *
 * `platformConfirmed`: Summoner-V4 just found them on `region`, which then
 * replaces the stored platform (a player who moved server kept the old one
 * forever, and with it the old match cluster). Only a lookup confirms it;
 * the crawler's profile refresh asks the platform already stored.
 */
export async function saveSummonerFromRiot(
  region: string,
  account: RiotAccountDto,
  profile: RiotSummonerDto,
  { platformConfirmed = false } = {},
) {
  const fields = {
    ...riotIdColumns(account.gameName, account.tagLine),
    profileIconId: profile.profileIconId,
    summonerLevel: profile.summonerLevel,
    ...(platformConfirmed && { region }),
  };
  const [summoner] = await db
    .insert(summoners)
    .values({ puuid: account.puuid, region, ...fields })
    .onConflictDoUpdate({ target: summoners.puuid, set: fields })
    .returning();
  return summoner!;
}
