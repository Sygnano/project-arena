import "server-only";
import type { DevSummonerList, GameCatalog, SummonerPageData, SummonerStatsPayload } from "@arena/types";

// Server-only (no NEXT_PUBLIC_ prefix, and `server-only` above keeps this
// module out of client bundles): the browser reaches the API through this
// app's own routes (`app/api/...`) and pages, never directly. Client-safe
// helpers live in `lib/summoner-query.ts`.
const API_URL = process.env.API_URL ?? "http://localhost:3001";
// Shared with the API, which refuses every request without it once set
// (apps/api/src/index.ts). Unset in local dev, like the API's.
const API_PROXY_SECRET = process.env.API_PROXY_SECRET;

// A read that takes longer fails (a TimeoutError) instead of hanging the
// page's render forever when the API is stuck. The slowest read, an
// uncached recap, takes well under a second; this leaves room for an API
// busy with other work. Covers the body too: `res.json()` shares the signal.
const READ_TIMEOUT_MS = 10_000;

/**
 * Every call to the API. `visitorIp` (see `lib/visitor-ip.ts`) is what the
 * API rate-limits by; without it the API counts this server's address. A
 * call without its own `signal` times out after READ_TIMEOUT_MS; the refresh
 * stream passes its own, since it stays open for as long as the fetch runs.
 */
function apiFetch(path: string, { visitorIp, ...init }: RequestInit & { visitorIp?: string | null } = {}) {
  const headers = new Headers(init.headers);
  if (API_PROXY_SECRET) headers.set("x-arena-proxy-secret", API_PROXY_SECRET);
  if (visitorIp) headers.set("x-arena-client-ip", visitorIp);
  return fetch(`${API_URL}${path}`, {
    cache: "no-store",
    ...init,
    signal: init.signal ?? AbortSignal.timeout(READ_TIMEOUT_MS),
    headers,
  });
}

function summonerApiPath(region: string, gameName: string, tagLine: string) {
  return `/summoners/by-riot-id/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
}

/** The API's refresh stream, for the proxy route: a server-sent event stream. */
export function fetchRefreshStream(
  region: string,
  gameName: string,
  tagLine: string,
  { visitorIp, signal }: { visitorIp: string | null; signal: AbortSignal },
) {
  return apiFetch(`${summonerApiPath(region, gameName, tagLine)}/refresh`, { method: "POST", visitorIp, signal });
}

/** The visitor asked for too many recaps; `retryAfterSeconds` says when to try again. */
export class RecapRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many recaps requested");
    this.name = "RecapRateLimitedError";
  }
}

/** The recap, with items and augments as ids (see `resolveStats`). Null when
 * the summoner isn't stored. Database only, never Riot. Rate-limited per
 * visitor by the API: throws `RecapRateLimitedError` past it. */
export async function getSummonerStatsByRiotId(
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

/** The stored summoner and their fetch in progress. Null when the Riot ID
 * isn't stored yet (the page then offers to fetch it). Database only. */
export async function getSummonerPage(
  region: string,
  gameName: string,
  tagLine: string,
): Promise<SummonerPageData | null> {
  const res = await apiFetch(summonerApiPath(region, gameName, tagLine));
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Failed to load the summoner (${res.status})`);
  return res.json();
}

/** Summoners with a recap, latest refresh first, for the /dev page, and
 * when the list was read (what its "ago" times count from). */
export async function getDevSummoners(): Promise<DevSummonerList & { readAt: number }> {
  const res = await apiFetch("/dev/summoners");
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
    const catalog = apiFetch("/catalog").then((res) => {
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

/** Site-wide totals for the splash page, from the API's `GET /overview`. */
export type Overview = {
  /** Every Arena match stored. */
  matchCount: number;
  /** Summoners with a recap: refreshed at least once, with a stored match. */
  recapCount: number;
};

export async function getOverview(): Promise<Overview> {
  const res = await apiFetch("/overview");
  if (!res.ok) throw new Error(`Failed to load the overview (${res.status})`);
  return res.json();
}
