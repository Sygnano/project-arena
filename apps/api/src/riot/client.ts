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
// Tries per request when Riot answers 429 or 5xx.
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 30_000;

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

/** Whether the client knows how to route a platform code (e.g. "euw1"). */
export function isSupportedRegion(region: string) {
  return Object.hasOwn(REGIONAL_CLUSTER, region.toLowerCase());
}

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

  /** Current Riot ID for a PUUID — match data only has the name as of that match. */
  async getAccountByPuuid(puuid: string, region: string) {
    const cluster = this.clusterFor(region);
    return this.request<RiotAccountDto>(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`,
      `Fetching account for puuid ${puuid} (${region})`,
    );
  }

  /**
   * Returns a summoner's full Arena match history, not just the most
   * recent page — Riot returns ids newest-first, capped at 100 per
   * request, so this pages with `start` until a short page confirms
   * there's nothing left (same approach as ../project-arena's fetcher).
   * `startTime` limits it to games that started at or after that moment.
   */
  async getArenaMatchIdsByPuuid(puuid: string, region: string, startTime?: Date) {
    const cluster = this.clusterFor(region);
    const allIds: string[] = [];
    let start = 0;
    const since = startTime ? `&startTime=${Math.floor(startTime.getTime() / 1000)}` : "";

    while (true) {
      const page = await this.request<string[]>(
        `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${ARENA_QUEUE_ID}&start=${start}&count=${MATCH_ID_PAGE_SIZE}${since}`,
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

  private async request<T>(url: string, label: string, attempt = 1): Promise<T> {
    const result = await this.limiter.schedule(async (): Promise<{ data: T } | { retryInMs: number }> => {
      console.log(`[riot] ${label}`);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { "X-Riot-Token": this.apiKey },
          // A connection that hangs would otherwise stall ingestion forever.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        // Network failure (connection reset, DNS, timeout): no response at
        // all, so retry like a 5xx rather than failing the whole refresh.
        if (attempt >= MAX_ATTEMPTS) throw err;
        const waitMs = 5000 * attempt;
        console.log(`[riot] ${label} -> network error (${err instanceof Error ? err.message : err}), retrying in ${waitMs}ms`);
        return { retryInMs: waitMs };
      }
      // A first-time fetch runs for many minutes; one 429 (Riot's own
      // limits can trip even when ours don't) or a transient 5xx shouldn't
      // fail it. Retried outside the limiter so the wait doesn't hold a slot.
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 * attempt) * 1000;
        console.log(`[riot] ${label} -> ${res.status}, retrying in ${waitMs}ms`);
        return { retryInMs: waitMs };
      }
      if (!res.ok) {
        console.log(`[riot] ${label} -> ${res.status}`);
        const body = await res.text();
        // PUUIDs are encrypted per Riot app: one stored under another app's key can't be decrypted.
        if (res.status === 400 && body.includes("Exception decrypting")) {
          throw new RiotApiError(
            res.status,
            `Riot API 400 for ${url}: PUUID was issued to a different Riot app than RIOT_API_KEY's — run \`pnpm --filter @arena/db remap-puuids\``,
          );
        }
        throw new RiotApiError(res.status, `Riot API ${res.status} for ${url}`);
      }
      return { data: (await res.json()) as T };
    });
    if ("data" in result) return result.data;
    await new Promise((resolve) => setTimeout(resolve, result.retryInMs));
    return this.request<T>(url, label, attempt + 1);
  }
}
