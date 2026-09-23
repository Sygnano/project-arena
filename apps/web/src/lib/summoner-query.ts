import type { SummonerView } from "@arena/types";

// Summoner-page helpers safe in the browser. The API fetchers themselves are
// server-only (`lib/api.ts`).

/** Shared between the server-side prefetch (page.tsx), the refresh stream
 * (which puts the new recap in the cache) and the client-side `useQuery`:
 * TanStack Query matches cached data to a query purely by this key. */
export function summonerStatsQueryKey(region: string, gameName: string, tagLine: string) {
  return ["summonerStats", region, gameName, tagLine] as const;
}

/** Whether the summoner has a recap to show (matches fetched at least once). */
export function hasRecap(summoner: SummonerView | null | undefined): summoner is SummonerView {
  return summoner?.lastRefreshedAt != null;
}

/** "in about 12 min" / "in a minute", for a rate limit's wait. */
export function formatRetryAfter(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "in a minute" : `in about ${minutes} min`;
}
