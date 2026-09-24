import type { Summoner } from "@arena/db";
import { RiotApiError, type RiotClient } from "@arena/riot";
import { logger, riotIdLabel } from "../logger.js";
import { saveSummonerFromRiot } from "../summoners/summonerRepository.js";

const log = logger.child({ module: "resolve" });

/**
 * A player's profile as Riot has it now. Both functions here make the Riot
 * calls (Account-V1 for the Riot ID, Summoner-V4 for the icon and level: 2
 * calls) and store the result through `saveSummonerFromRiot`, the one writer
 * of Riot-sourced profile fields. Match data never overwrites them (see
 * `ingestSummoner`): account-v1 is the only source of a current Riot ID.
 * The caller's `riot` client decides the gateway bucket the calls wait in.
 */

/**
 * Looks a Riot ID up at Riot and stores the player. Null when Riot doesn't
 * know them: no such Riot ID, or one that never played League on this
 * platform.
 */
export async function resolveSummonerByRiotId(
  riot: RiotClient,
  region: string,
  gameName: string,
  tagLine: string,
): Promise<Summoner | null> {
  try {
    const account = await riot.account.getAccountByRiotId(gameName, tagLine, region);
    const profile = await riot.summoner.getSummonerByPuuid(account.puuid, region);
    // Riot's casing wins over what was typed.
    const summoner = await saveSummonerFromRiot(
      region,
      { ...account, gameName: account.gameName ?? gameName, tagLine: account.tagLine ?? tagLine },
      profile,
      { platformConfirmed: true },
    );
    log.info({ summoner: riotIdLabel(summoner), region }, "summoner found at Riot");
    return summoner;
  } catch (err) {
    if (err instanceof RiotApiError && err.status === 404) {
      log.info({ summoner: `${gameName}#${tagLine}`, region }, "no such summoner at Riot");
      return null;
    }
    throw err;
  }
}

/**
 * Brings a stored summoner's Riot ID, icon and level up to date (the
 * crawler, before each summoner: a discovered row holds whatever the match
 * it was met in said, which can predate a rename). Returns the stored row.
 * Throws on any Riot error, 404 included.
 */
export async function refreshSummonerProfile(
  riot: RiotClient,
  summoner: Pick<Summoner, "puuid" | "region" | "riotIdGameName" | "riotIdTagline">,
): Promise<Summoner> {
  const account = await riot.account.getAccountByPuuid(summoner.puuid, summoner.region);
  const profile = await riot.summoner.getSummonerByPuuid(summoner.puuid, summoner.region);
  return saveSummonerFromRiot(
    summoner.region,
    // An account without a Riot ID keeps the one we have.
    {
      ...account,
      gameName: account.gameName ?? summoner.riotIdGameName,
      tagLine: account.tagLine ?? summoner.riotIdTagline,
    },
    profile,
  );
}
