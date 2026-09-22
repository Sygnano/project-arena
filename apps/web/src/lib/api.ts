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

/** One tracked summoner's refresh state, from the API's status route. */
export type SummonerStatus = {
  region: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  /** When the summoner's matches were last fetched from Riot (a finished
   * refresh, by a search, the refresh button or the crawler); null if never.
   * Not touched by views. */
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

/** Whether a refresh of this summoner is queued or running. */
export function isRefreshing(status: SummonerStatus | null): boolean {
  const state = status?.job?.state;
  return state === "queued" || state === "running";
}

/** Whether the summoner page should show the fetch screens (never fetched:
 * the "fetch matches" button, then the queue) instead of the recap. A
 * summoner who already has a recap keeps it while a refresh runs (the
 * Welcome slide reports the update), so a shared link never turns into a
 * queue screen because someone else searched that summoner. */
export function needsRefreshScreen(status: SummonerStatus | null): boolean {
  if (!status || status.lastRefreshedAt === null) return true;
  return status.matchCount === 0 && isRefreshing(status);
}

export type LookupResult =
  | { ok: true; region: string; gameName: string; tagLine: string }
  | { ok: false; error: "invalid" | "not_found" | "unavailable" | "busy" }
  // Too many lookups (or first fetches) from this visitor's IP.
  | { ok: false; error: "rate_limited"; retryAfterSeconds: number };

/** "in about 12 min" / "in a minute", for a rate limit's wait. */
export function formatRetryAfter(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "in a minute" : `in about ${minutes} min`;
}

/** POST /summoners/lookup — server-only (reads API_URL); the browser goes
 * through the `lookupSummoner` server action. `fetch` also queues the first
 * fetch of a never-fetched summoner (the summoner page's button); without
 * it only stale, already-fetched summoners get refreshed. */
export async function lookupRiotId(
  region: string,
  gameName: string,
  tagLine: string,
  fetchMatches = false,
  clientIp: string | null = null,
): Promise<LookupResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/summoners/lookup`, {
      method: "POST",
      // The API rate-limits per visitor, and only sees this server's address.
      headers: {
        "content-type": "application/json",
        ...(clientIp ? { "x-arena-client-ip": clientIp } : {}),
      },
      body: JSON.stringify({ region, gameName, tagLine, fetch: fetchMatches }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (res.status === 400) return { ok: false, error: "invalid" };
  if (res.status === 404) return { ok: false, error: "not_found" };
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retryAfterSeconds?: number };
    return { ok: false, error: "rate_limited", retryAfterSeconds: body.retryAfterSeconds ?? 60 };
  }
  if (res.status === 503) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "busy") return { ok: false, error: "busy" };
  }
  if (!res.ok) return { ok: false, error: "unavailable" };
  const body = (await res.json()) as { region: string; gameName: string; tagLine: string };
  return { ok: true, ...body };
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
