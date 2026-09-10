import type {
  RiotAccountDto,
  RiotArenaMatchDto,
  RiotMatchTimelineDto,
  RiotSummonerDto,
} from "@arena/types";
import { CompositeRateLimiter } from "./rateLimiter.js";

const ARENA_QUEUE_ID = 1750;
// Match-V5's match-ids-by-puuid endpoint caps `count` at 100 per request —
// getting a summoner's full history requires paging with `start`.
const MATCH_ID_PAGE_SIZE = 100;

// Platform region -> regional routing cluster, used by account-v1 and match-v5.
const REGIONAL_CLUSTER: Record<string, "europe" | "americas" | "asia"> = {
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  kr: "asia",
  jp1: "asia",
};

export class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thin Riot API wrapper for the ingestion pipeline. Rate-limited to a
 * personal/dev key's limits (20 req/1s, 100 req/2min) — see CLAUDE.md §3.
 */
export class RiotClient {
  private limiter = new CompositeRateLimiter([
    { limit: 20, windowMs: 1000 },
    { limit: 100, windowMs: 120_000 },
  ]);

  constructor(private readonly apiKey: string) {}

  async getAccountByRiotId(gameName: string, tagLine: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<RiotAccountDto>(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      `Fetching account ${gameName}#${tagLine} (${region})`,
    );
  }

  /**
   * Returns a summoner's full Arena match history, not just the most
   * recent page — Riot returns ids newest-first, capped at 100 per
   * request, so this pages with `start` until a short page confirms
   * there's nothing left (same approach as ../project-arena's fetcher).
   */
  async getArenaMatchIdsByPuuid(puuid: string, region: string) {
    const cluster = this.clusterFor(region);
    const allIds: string[] = [];
    let start = 0;

    while (true) {
      const page = await this.request<string[]>(
        `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${ARENA_QUEUE_ID}&start=${start}&count=${MATCH_ID_PAGE_SIZE}`,
        `Fetching match ids for puuid ${puuid} (${region}) [start=${start}]`,
      );
      allIds.push(...page);
      if (page.length < MATCH_ID_PAGE_SIZE) break;
      start += MATCH_ID_PAGE_SIZE;
    }

    return allIds;
  }

  async getMatch(matchId: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<RiotArenaMatchDto>(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      `Fetching match ${matchId}`,
    );
  }

  /** Summoner-V4 — platform routed, unlike the regional-cluster calls above. */
  async getSummonerByPuuid(puuid: string, region: string) {
    return this.request<RiotSummonerDto>(
      `https://${region.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      `Fetching summoner profile for puuid ${puuid} (${region})`,
    );
  }

  async getMatchTimeline(matchId: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<RiotMatchTimelineDto>(
      `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
      `Fetching timeline ${matchId}`,
    );
  }

  private clusterFor(region: string) {
    const cluster = REGIONAL_CLUSTER[region.toLowerCase()];
    if (!cluster) throw new Error(`Unknown Riot region "${region}" — add it to REGIONAL_CLUSTER`);
    return cluster;
  }

  private async request<T>(url: string, label: string): Promise<T> {
    return this.limiter.schedule(async () => {
      console.log(`[riot] ${label}`);
      const res = await fetch(url, {
        headers: { "X-Riot-Token": this.apiKey },
      });
      if (!res.ok) {
        console.log(`[riot] ${label} -> ${res.status}`);
        throw new RiotApiError(res.status, `Riot API ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    });
  }
}
