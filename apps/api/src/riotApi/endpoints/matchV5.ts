import type { RiotArenaMatchDto, RiotMatchTimelineDto } from "@arena/types";
import type { RiotHttpClient } from "../http.js";
import type { QueueId } from "../queues.js";
import { matchRegion, platformOfMatch, toPlatform } from "../routing.js";

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

/** "2026-09-20 14:05" (UTC), for log lines. */
const shortDate = (date: Date) => date.toISOString().slice(0, 16).replace("T", " ");

/** Match-V5: match lists, match details and timelines. Regional (europe, americas, asia, sea). */
export class MatchV5 {
  constructor(private readonly http: RiotHttpClient) {}

  /** One page of a player's match ids, newest first. */
  getMatchIdsByPuuid(puuid: string, platform: string, filters: MatchIdFilters = {}, page: MatchIdPage = {}) {
    const p = toPlatform(platform);
    const start = page.start ?? 0;
    const count = page.count ?? MATCH_ID_PAGE_SIZE;
    return this.http.request<string[]>({
      api: "Match-V5",
      method: "getMatchIdsByPuuid",
      platform: p,
      routing: matchRegion(p),
      path: `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
      query: {
        queue: filters.queue,
        type: filters.type,
        startTime: epochSeconds(filters.startTime),
        endTime: epochSeconds(filters.endTime),
        start,
        count,
      },
      args: [
        puuid,
        filters.queue !== undefined ? `queue=${filters.queue}` : "",
        filters.type ? `type=${filters.type}` : "",
        filters.startTime ? `since=${shortDate(filters.startTime)}` : "",
        filters.endTime ? `until=${shortDate(filters.endTime)}` : "",
        `start=${start}`,
      ].filter(Boolean),
    });
  }

  /**
   * Every match id matching the filters, newest first: pages until a short
   * page says there's nothing left. A first fetch of a long-time player
   * costs one call per 100 matches.
   */
  async getAllMatchIdsByPuuid(puuid: string, platform: string, filters: MatchIdFilters = {}) {
    const ids: string[] = [];
    for (let start = 0; ; start += MATCH_ID_PAGE_SIZE) {
      const page = await this.getMatchIdsByPuuid(puuid, platform, filters, { start, count: MATCH_ID_PAGE_SIZE });
      ids.push(...page);
      if (page.length < MATCH_ID_PAGE_SIZE) return ids;
    }
  }

  getMatch(matchId: string) {
    const p = platformOfMatch(matchId);
    return this.http.request<RiotArenaMatchDto>({
      api: "Match-V5",
      method: "getMatch",
      platform: p,
      routing: matchRegion(p),
      path: `/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
      args: [matchId],
    });
  }

  getMatchTimeline(matchId: string) {
    const p = platformOfMatch(matchId);
    return this.http.request<RiotMatchTimelineDto>({
      api: "Match-V5",
      method: "getMatchTimeline",
      platform: p,
      routing: matchRegion(p),
      path: `/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`,
      args: [matchId],
    });
  }
}
