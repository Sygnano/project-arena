import "server-only";
import type { SummonerStatsPayload } from "@arena/types";
import { apiFetch } from "@/lib/api-client";
import { summonerApiPath } from "./summoner-api-path";

/** The visitor asked for too many recaps; `retryAfterSeconds` says when to try again. */
class RecapRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many recaps requested");
    this.name = "RecapRateLimitedError";
  }
}

/** The recap, with items and augments as ids (see `resolveStats`). Null when
 * the summoner isn't stored. Database only, never Riot. Rate-limited per
 * visitor by the API: throws `RecapRateLimitedError` past it. */
async function getSummonerStatsByRiotId(
  region: string,
  gameName: string,
  tagLine: string,
  visitorIp: string | null,
): Promise<SummonerStatsPayload | null> {
  const res = await apiFetch(`${summonerApiPath(region, gameName, tagLine)}/stats`, { visitorIp });
  if (res.status === 404) return null;
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retryAfterSeconds?: number };
    throw new RecapRateLimitedError(body.retryAfterSeconds ?? 60);
  }
  if (!res.ok) throw new Error(`Failed to load summoner stats (${res.status})`);
  return res.json();
}

export { getSummonerStatsByRiotId, RecapRateLimitedError };
