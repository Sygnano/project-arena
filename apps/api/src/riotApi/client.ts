import { AccountV1 } from "./endpoints/accountV1.js";
import { MatchV5 } from "./endpoints/matchV5.js";
import { SummonerV4 } from "./endpoints/summonerV4.js";
import { RiotHttpClient } from "./http.js";
import { RiotLogger, type LogLevel } from "./logger.js";
import type { WindowLimit } from "./rateLimiting/headers.js";
import { RiotRateLimiter } from "./rateLimiting/rateLimiter.js";

/**
 * A development or personal key's app limits, per region. Only the starting
 * point: the first response from each region replaces them with what Riot
 * reports, so a production key needs no change here.
 */
export const DEV_KEY_APP_LIMITS: WindowLimit[] = [
  { limit: 20, windowSec: 1 },
  { limit: 100, windowSec: 120 },
];

export interface RiotClientOptions {
  apiKey: string;
  /** Default "info": one line per response. "debug" adds every rate-limit wait. */
  logLevel?: LogLevel;
  appLimits?: WindowLimit[];
  maxAttempts?: number;
  timeoutMs?: number;
}

/**
 * The Riot API, one property per Riot API:
 *
 *   riot.account.getAccountByRiotId(gameName, tagLine, platform)
 *   riot.summoner.getSummonerByPuuid(puuid, platform)
 *   riot.match.getAllMatchIdsByPuuid(puuid, platform, { queue: Queue.ARENA })
 *
 * One instance per process: its rate limiter only knows about the calls it
 * made (plus what Riot's count headers say about the others).
 */
export class RiotClient {
  readonly account: AccountV1;
  readonly summoner: SummonerV4;
  readonly match: MatchV5;

  constructor(options: RiotClientOptions) {
    const http = new RiotHttpClient({
      apiKey: options.apiKey,
      limiter: new RiotRateLimiter(options.appLimits ?? DEV_KEY_APP_LIMITS),
      logger: new RiotLogger(options.logLevel),
      maxAttempts: options.maxAttempts,
      timeoutMs: options.timeoutMs,
    });
    this.account = new AccountV1(http);
    this.summoner = new SummonerV4(http);
    this.match = new MatchV5(http);
  }
}
