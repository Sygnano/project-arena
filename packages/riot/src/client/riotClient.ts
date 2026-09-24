import type { RiotAccountDto, RiotArenaMatchDto, RiotMatchTimelineDto, RiotSummonerDto } from "@arena/types";
import { gatewayPaths } from "../protocol.js";
import type { QueueId } from "../queues.js";
import { platformOfMatch, toPlatform } from "../routing.js";
import type { GatewayRequestOptions, RiotGateway } from "./gateway.js";

/** Riot caps `count` at 100, so a full history takes several pages. */
const MATCH_ID_PAGE_SIZE = 100;

/** Filters for a match-id list. All optional: none returns every queue, all time. */
export interface MatchIdFilters {
  /** Only this queue (see queues.ts). */
  queue?: QueueId;
  /** Only this match type. */
  type?: "ranked" | "normal" | "tourney" | "tutorial";
  /** Only games that started at or after this moment. */
  startTime?: Date;
  /** Only games that started at or before this moment. */
  endTime?: Date;
}

export interface MatchIdPage {
  /** Offset into the newest-first list. Default 0. */
  start?: number;
  /** 1-100. Default 100. */
  count?: number;
}

const epochSeconds = (date: Date | undefined) => (date ? Math.floor(date.getTime() / 1000) : undefined);

/**
 * The Riot endpoints the app uses, one property per Riot API, every call in
 * one priority bucket (from `RiotGateway.client(priority)`):
 *
 *   riot.account.getAccountByRiotId(gameName, tagLine, platform)
 *   riot.summoner.getSummonerByPuuid(puuid, platform)
 *   riot.match.getAllMatchIdsByPuuid(puuid, platform, { queue: Queue.ARENA })
 *
 * Platforms are passed as stored (`summoners.region`: "euw1", any case); an
 * unknown one throws before any request. Adding an endpoint means a route in
 * the gateway, its path in `gatewayPaths`, and a method here.
 */
export class RiotClient {
  constructor(
    private readonly gateway: RiotGateway,
    private readonly options: GatewayRequestOptions,
  ) {}

  private get<T>(path: string, describe: string, query?: Record<string, string | number | undefined>) {
    return this.gateway.request<T>(path, query, describe, this.options);
  }

  /** Account-V1: Riot ID <-> PUUID. */
  readonly account = {
    /** Resolves a Riot ID. 404 = no such Riot ID. */
    getAccountByRiotId: (gameName: string, tagLine: string, platform: string) =>
      this.get<RiotAccountDto>(
        gatewayPaths.accountByRiotId(toPlatform(platform), gameName, tagLine),
        `getAccountByRiotId ${gameName}#${tagLine}`,
      ),
    /** Current Riot ID for a PUUID; match data only has the name as of that match. */
    getAccountByPuuid: (puuid: string, platform: string) =>
      this.get<RiotAccountDto>(gatewayPaths.accountByPuuid(toPlatform(platform), puuid), `getAccountByPuuid ${puuid}`),
  };

  /** Summoner-V4: profile icon and level. */
  readonly summoner = {
    /** 404 = the Riot ID exists but has never played League on this platform. */
    getSummonerByPuuid: (puuid: string, platform: string) =>
      this.get<RiotSummonerDto>(
        gatewayPaths.summonerByPuuid(toPlatform(platform), puuid),
        `getSummonerByPuuid ${puuid}`,
      ),
  };

  /** Match-V5: match lists, match details and timelines. */
  readonly match = {
    /** One page of a player's match ids, newest first. */
    getMatchIdsByPuuid: (puuid: string, platform: string, filters: MatchIdFilters = {}, page: MatchIdPage = {}) =>
      this.get<string[]>(gatewayPaths.matchIdsByPuuid(toPlatform(platform), puuid), `getMatchIdsByPuuid ${puuid}`, {
        queue: filters.queue,
        type: filters.type,
        startTime: epochSeconds(filters.startTime),
        endTime: epochSeconds(filters.endTime),
        start: page.start ?? 0,
        count: page.count ?? MATCH_ID_PAGE_SIZE,
      }),

    /**
     * Every match id matching the filters, newest first: pages until a short
     * page says there's nothing left. A first fetch of a long-time player
     * costs one call per 100 matches, each its own turn at the gateway.
     */
    getAllMatchIdsByPuuid: async (puuid: string, platform: string, filters: MatchIdFilters = {}) => {
      const ids: string[] = [];
      for (let start = 0; ; start += MATCH_ID_PAGE_SIZE) {
        const page = await this.match.getMatchIdsByPuuid(puuid, platform, filters, {
          start,
          count: MATCH_ID_PAGE_SIZE,
        });
        ids.push(...page);
        if (page.length < MATCH_ID_PAGE_SIZE) return ids;
      }
    },

    getMatch: (matchId: string) => {
      platformOfMatch(matchId);
      return this.get<RiotArenaMatchDto>(gatewayPaths.match(matchId), `getMatch ${matchId}`);
    },

    getMatchTimeline: (matchId: string) => {
      platformOfMatch(matchId);
      return this.get<RiotMatchTimelineDto>(gatewayPaths.matchTimeline(matchId), `getMatchTimeline ${matchId}`);
    },
  };
}
