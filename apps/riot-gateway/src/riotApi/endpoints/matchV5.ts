import { matchRegion, platformOfMatch, type Platform } from "@arena/riot";
import type { RiotCallSpec } from "../types.js";

/** Match-V5: match lists, match details and timelines. Regional (europe, americas, asia, sea). */

/** A match-id list's query, as Riot takes it (times in epoch seconds). */
export interface MatchIdQuery {
  queue?: number;
  type?: "ranked" | "normal" | "tourney" | "tutorial";
  startTime?: number;
  endTime?: number;
  start: number;
  count: number;
}

/** "2026-09-20 14:05" (UTC), for log lines. */
const shortDate = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString().slice(0, 16).replace("T", " ");

/** One page of a player's match ids, newest first. */
export function getMatchIdsByPuuid(platform: Platform, puuid: string, query: MatchIdQuery): RiotCallSpec {
  return {
    api: "Match-V5",
    method: "getMatchIdsByPuuid",
    platform,
    routing: matchRegion(platform),
    path: `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
    query: { ...query },
    args: [
      puuid,
      query.queue !== undefined ? `queue=${query.queue}` : "",
      query.type ? `type=${query.type}` : "",
      query.startTime !== undefined ? `since=${shortDate(query.startTime)}` : "",
      query.endTime !== undefined ? `until=${shortDate(query.endTime)}` : "",
      `start=${query.start}`,
    ].filter(Boolean),
  };
}

/** The platform is read from the id ("EUW1_..."); throws on one Riot doesn't route. */
export function getMatch(matchId: string): RiotCallSpec {
  const platform = platformOfMatch(matchId);
  return {
    api: "Match-V5",
    method: "getMatch",
    platform,
    routing: matchRegion(platform),
    path: `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    args: [matchId],
  };
}

export function getMatchTimeline(matchId: string): RiotCallSpec {
  const platform = platformOfMatch(matchId);
  return {
    api: "Match-V5",
    method: "getMatchTimeline",
    platform,
    routing: matchRegion(platform),
    path: `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
    args: [matchId],
  };
}
