import type { Platform } from "@arena/riot";
import type { RiotCallSpec } from "../types.js";

/** Summoner-V4: profile icon and level. Platform routed (euw1, na1, ...), unlike Account-V1 and Match-V5. */

/** 404 = the Riot ID exists but has never played League on this platform. */
export function getSummonerByPuuid(platform: Platform, puuid: string): RiotCallSpec {
  return {
    api: "Summoner-V4",
    method: "getSummonerByPuuid",
    platform,
    routing: platform,
    path: `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
    args: [puuid],
  };
}
