import type { RiotAccountDto } from "@arena/types";
import type { RiotHttpClient } from "../http.js";
import { accountRegion, toPlatform } from "../routing.js";

/**
 * Account-V1: Riot ID <-> PUUID. Regional: any cluster answers for any
 * player, but each call goes to the player's own cluster so the load spreads
 * over each region's rate limits the same way their match calls do.
 */
export class AccountV1 {
  constructor(private readonly http: RiotHttpClient) {}

  /** Resolves a Riot ID. 404 = no such Riot ID. */
  getAccountByRiotId(gameName: string, tagLine: string, platform: string) {
    const p = toPlatform(platform);
    return this.http.request<RiotAccountDto>({
      api: "Account-V1",
      method: "getAccountByRiotId",
      platform: p,
      routing: accountRegion(p),
      path: `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      args: [`${gameName}#${tagLine}`],
    });
  }

  /** Current Riot ID for a PUUID; match data only has the name as of that match. */
  getAccountByPuuid(puuid: string, platform: string) {
    const p = toPlatform(platform);
    return this.http.request<RiotAccountDto>({
      api: "Account-V1",
      method: "getAccountByPuuid",
      platform: p,
      routing: accountRegion(p),
      path: `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
      args: [puuid],
    });
  }
}
