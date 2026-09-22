import type { Summoner } from "@arena/db";
import { logger } from "../logger.js";
import { riot, RiotApiError } from "../riotApi/index.js";
import { saveSummonerFromRiot } from "../summoners/summonerRepository.js";

const log = logger.child({ module: "resolve" });

/**
 * Looks a Riot ID up at Riot (Account-V1, then Summoner-V4 for the icon and
 * level: 2 calls) and stores the player. Null when Riot doesn't know them:
 * no such Riot ID, or one that never played League on this platform.
 */
export async function resolveSummonerByRiotId(region: string, gameName: string, tagLine: string): Promise<Summoner | null> {
  try {
    const account = await riot.account.getAccountByRiotId(gameName, tagLine, region);
    const profile = await riot.summoner.getSummonerByPuuid(account.puuid, region);
    // Riot's casing wins over what was typed.
    const summoner = await saveSummonerFromRiot(
      region,
      { ...account, gameName: account.gameName ?? gameName, tagLine: account.tagLine ?? tagLine },
      profile,
    );
    log.info({ summoner: `${summoner.riotIdGameName}#${summoner.riotIdTagline}`, region }, "summoner found at Riot");
    return summoner;
  } catch (err) {
    if (err instanceof RiotApiError && err.status === 404) {
      log.info({ summoner: `${gameName}#${tagLine}`, region }, "no such summoner at Riot");
      return null;
    }
    throw err;
  }
}
