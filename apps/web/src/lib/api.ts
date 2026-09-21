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

/** One tracked summoner as listed by the API's `GET /summoners`. */
export type TrackedSummoner = {
  puuid: string;
  riotIdGameName: string;
  riotIdTagline: string;
  region: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  lastRefreshedAt: string | null;
};

/** One tracked summoner's refresh state, from the API's status route. */
export type SummonerStatus = {
  region: string;
  gameName: string;
  tagLine: string;
  lastRefreshedAt: string | null;
  matchCount: number;
  job: {
    state: "queued" | "running" | "done" | "failed";
    position: number;
    phase: "matchIds" | "matches" | null;
    done: number;
    total: number;
    etaSeconds: number | null;
    error: string | null;
  } | null;
};

/** Null when the Riot ID isn't tracked yet (it then needs a lookup). */
export async function getSummonerStatus(
  region: string,
  gameName: string,
  tagLine: string,
): Promise<SummonerStatus | null> {
  const res = await fetch(
    `${API_URL}/summoners/by-riot-id/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/status`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load summoner status (${res.status})`);
  return res.json();
}

/** Whether the summoner page should show the queue screen instead of the recap. */
export function needsRefreshScreen(status: SummonerStatus | null): boolean {
  if (!status) return true;
  const state = status.job?.state;
  return state === "queued" || state === "running" || status.lastRefreshedAt === null;
}

export type LookupResult =
  | { ok: true; region: string; gameName: string; tagLine: string }
  | { ok: false; error: "invalid" | "not_found" | "unavailable" };

/** POST /summoners/lookup — server-only (reads API_URL); the browser goes
 * through the `lookupSummoner` server action. */
export async function lookupRiotId(region: string, gameName: string, tagLine: string): Promise<LookupResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/summoners/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region, gameName, tagLine }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (res.status === 400) return { ok: false, error: "invalid" };
  if (res.status === 404) return { ok: false, error: "not_found" };
  if (!res.ok) return { ok: false, error: "unavailable" };
  const body = (await res.json()) as { region: string; gameName: string; tagLine: string };
  return { ok: true, ...body };
}

/** The `count` most recently refreshed summoners, newest first. */
export async function getRecentSummoners(count: number): Promise<TrackedSummoner[]> {
  const res = await fetch(`${API_URL}/summoners?recent=${count}`, { cache: "no-store" });
  if (!res.ok)
    throw new Error(`Failed to load tracked summoners (${res.status})`);
  return res.json();
}
