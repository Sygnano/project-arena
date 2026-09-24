import { accountRegion, type Platform } from "@arena/riot";
import type { RiotCallSpec } from "../types.js";

/**
 * Account-V1: Riot ID <-> PUUID. Regional: any cluster answers for any
 * player, but each call goes to the player's own cluster so the load spreads
 * over each region's rate limits the same way their match calls do.
 */

/** Resolves a Riot ID. 404 = no such Riot ID. */
export function getAccountByRiotId(platform: Platform, gameName: string, tagLine: string): RiotCallSpec {
  return {
    api: "Account-V1",
    method: "getAccountByRiotId",
    platform,
    routing: accountRegion(platform),
    path: `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    args: [`${gameName}#${tagLine}`],
  };
}

/** Current Riot ID for a PUUID; match data only has the name as of that match. */
export function getAccountByPuuid(platform: Platform, puuid: string): RiotCallSpec {
  return {
    api: "Account-V1",
    method: "getAccountByPuuid",
    platform,
    routing: accountRegion(platform),
    path: `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
    args: [puuid],
  };
}
