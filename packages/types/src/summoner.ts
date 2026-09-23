import type { SummonerStatsPayload } from "./catalog.js";

/**
 * The summoner page's contract with the API, shared by both apps.
 *
 * - `GET /summoners/by-riot-id/:region/:gameName/:tagLine` → `SummonerPageData`
 *   (our database only, never Riot; 404 when the Riot ID isn't stored yet).
 * - `GET .../stats` → `SummonerStatsPayload` (our database only; names and
 *   icons come from `GET /catalog`).
 * - `POST .../refresh` → a `text/event-stream` of `RefreshEvent`s. The only
 *   route that reaches Riot: it resolves an unknown Riot ID, fetches new
 *   matches through the refresh queue, and ends with the new stats.
 */

/** A stored summoner, as the page shows them before (or without) a recap. */
export interface SummonerView {
  region: string;
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  /** When their matches were last fetched from Riot (ISO), null if never.
   * Set only when a fetch finishes, never by a view. */
  lastRefreshedAt: string | null;
  /** Arena games in their recap. */
  matchCount: number;
}

/** Where a summoner's match fetch stands in the refresh queue. */
export interface RefreshProgress {
  state: "queued" | "running" | "done" | "failed";
  /** Fetches that run before this one (0 once it runs). */
  position: number;
  /** `matchIds`: reading the match list; `matches`: fetching them one by one. */
  phase: "matchIds" | "matches" | null;
  done: number;
  total: number;
  /** Rough seconds left while fetching matches, null otherwise. */
  etaSeconds: number | null;
  error: string | null;
}

export interface SummonerPageData {
  summoner: SummonerView;
  /** The fetch in progress (or just finished), null when there's none. */
  refresh: RefreshProgress | null;
}

/** Why a refresh stream ended without stats. */
export type RefreshErrorCode =
  /** Riot has no such Riot ID on this platform. */
  | "not_found"
  /** Too many Riot lookups or first fetches from this visitor. */
  | "rate_limited"
  /** The queue is too long to take another first fetch. */
  | "busy"
  /** The fetch failed partway (matches fetched so far are kept). */
  | "failed"
  /** Something else went wrong (Riot or the database unreachable). */
  | "unavailable";

/**
 * One server-sent event of `POST .../refresh`, by SSE event name:
 * `summoner` (resolved, and again with the new `lastRefreshedAt` at the end),
 * `progress` (every queue/fetch change), `stats` (the recap, once),
 * `error` (then the stream ends), `done` (the stream ends normally).
 */
export type RefreshEvent =
  | { event: "summoner"; data: SummonerView }
  | { event: "progress"; data: RefreshProgress }
  | { event: "stats"; data: SummonerStatsPayload }
  | { event: "error"; data: { code: RefreshErrorCode; retryAfterSeconds?: number } }
  | { event: "done"; data: Record<string, never> };

/** A summoner with a recap, as the dev page lists them (`GET /dev/summoners`). */
export interface DevSummonerRow {
  gameName: string;
  tagLine: string;
  /** Game server, as stored ("euw1"). */
  platform: string;
  /** Its Match-V5 cluster, and refresh queue lane ("europe"). */
  region: string;
  /** Every stored match they played, placement-0 ones included. */
  matchCount: number;
  lastRefreshedAt: string;
}

export interface DevSummonerList {
  /** Every summoner with a recap; `summoners` holds the latest ones only. */
  total: number;
  summoners: DevSummonerRow[];
}
