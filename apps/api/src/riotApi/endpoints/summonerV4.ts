import type { RiotSummonerDto } from "@arena/types";
import type { RiotHttpClient } from "../http.js";
import { toPlatform } from "../routing.js";

/** Summoner-V4: profile icon and level. Platform routed (euw1, na1, ...), unlike Account-V1 and Match-V5. */
export class SummonerV4 {
  constructor(private readonly http: RiotHttpClient) {}

  /** 404 = the Riot ID exists but has never played League on this platform. */
  getSummonerByPuuid(puuid: string, platform: string) {
    const p = toPlatform(platform);
    return this.http.request<RiotSummonerDto>({
      api: "Summoner-V4",
      method: "getSummonerByPuuid",
      platform: p,
      routing: p,
      path: `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
      args: [puuid],
    });
  }
}
