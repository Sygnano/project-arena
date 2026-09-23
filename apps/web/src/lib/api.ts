import type { DevSummonerList, GameCatalog, SummonerPageData, SummonerStatsPayload, SummonerView } from "@arena/types";

// Server-only (no NEXT_PUBLIC_ prefix): the browser reaches the API through
// this app's own routes (`app/api/...`), never directly.
const API_URL = process.env.API_URL ?? "http://localhost:3001";

function summonerApiPath(region: string, gameName: string, tagLine: string) {
  return `/summoners/by-riot-id/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
}

/** The API's URL for a summoner's refresh stream, for the proxy route. */
export function refreshStreamUrl(region: string, gameName: string, tagLine: string) {
  return `${API_URL}${summonerApiPath(region, gameName, tagLine)}/refresh`;
}

/** The recap, with items and augments as ids (see `resolveStats`). Null when
 * the summoner isn't stored. Database only, never Riot. */
export async function getSummonerStatsByRiotId(
  region: string,
  gameName: string,
  tagLine: string,
): Promise<SummonerStatsPayload | null> {
  const res = await fetch(`${API_URL}${summonerApiPath(region, gameName, tagLine)}/stats`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load summoner stats (${res.status})`);
  return res.json();
}

/** Shared between the server-side prefetch (page.tsx), the refresh stream
 * (which puts the new recap in the cache) and the client-side `useQuery`:
 * TanStack Query matches cached data to a query purely by this key. */
export function summonerStatsQueryKey(region: string, gameName: string, tagLine: string) {
  return ["summonerStats", region, gameName, tagLine] as const;
}

/** The stored summoner and their fetch in progress. Null when the Riot ID
 * isn't stored yet (the page then offers to fetch it). Database only. */
export async function getSummonerPage(
  region: string,
  gameName: string,
  tagLine: string,
): Promise<SummonerPageData | null> {
  const res = await fetch(`${API_URL}${summonerApiPath(region, gameName, tagLine)}`, { cache: "no-store" });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Failed to load the summoner (${res.status})`);
  return res.json();
}

/** Whether the summoner has a recap to show (matches fetched at least once). */
export function hasRecap(summoner: SummonerView | null | undefined): summoner is SummonerView {
  return summoner?.lastRefreshedAt != null;
}

/** Summoners with a recap, latest refresh first, for the /dev page, and
 * when the list was read (what its "ago" times count from). */
export async function getDevSummoners(): Promise<DevSummonerList & { readAt: number }> {
  const res = await fetch(`${API_URL}/dev/summoners`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load the summoner list (${res.status})`);
  return { ...((await res.json()) as DevSummonerList), readAt: Date.now() };
}

const CATALOG_TTL_MS = 60 * 60_000;
let catalogCache: { at: number; catalog: Promise<GameCatalog> } | null = null;

/**
 * Champion, item and augment names and icons (`GET /catalog`), which recaps
 * reference by id. Kept in this server's memory for an hour (it changes with
 * a patch), shared by every page; a failed fetch isn't kept.
 */
export function getGameCatalog(): Promise<GameCatalog> {
  if (!catalogCache || Date.now() - catalogCache.at > CATALOG_TTL_MS) {
    const catalog = fetch(`${API_URL}/catalog`, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`Failed to load the game catalog (${res.status})`);
      return res.json() as Promise<GameCatalog>;
    });
    catalogCache = { at: Date.now(), catalog };
    catalog.catch(() => {
      if (catalogCache?.catalog === catalog) catalogCache = null;
    });
  }
  return catalogCache.catalog;
}

/** "in about 12 min" / "in a minute", for a rate limit's wait. */
export function formatRetryAfter(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "in a minute" : `in about ${minutes} min`;
}

/** Site-wide totals for the splash page, from the API's `GET /overview`. */
export type Overview = {
  /** Every Arena match stored. */
  matchCount: number;
  /** Summoners with a recap: refreshed at least once, with a stored match. */
  recapCount: number;
};

export async function getOverview(): Promise<Overview> {
  const res = await fetch(`${API_URL}/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load the overview (${res.status})`);
  return res.json();
}
