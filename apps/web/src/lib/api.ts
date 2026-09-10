import type { SummonerStatsResponse } from "@arena/types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function fetchStats(path: string): Promise<SummonerStatsResponse | null> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load summoner stats (${res.status})`);
  return res.json();
}

export async function getSummonerStatsByRiotId(
  region: string,
  gameName: string,
  tagLine: string,
): Promise<SummonerStatsResponse | null> {
  return fetchStats(
    `/summoners/by-riot-id/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/stats`,
  );
}

/** Shared between the server-side prefetch (page.tsx) and the client-side
 * useQuery reading the hydrated cache (app/summoner/[platform]/[riotId]/stats-view.tsx) — TanStack
 * Query matches cached data to a query purely by this key, so both sides
 * must build it identically. */
export function summonerStatsQueryKey(region: string, gameName: string, tagLine: string) {
  return ["summonerStats", region, gameName, tagLine] as const;
}
