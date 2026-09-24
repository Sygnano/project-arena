/**
 * The Riot gateway's wire contract (apps/riot-gateway), shared by the
 * gateway and its client (`RiotGateway`).
 *
 * One route per Riot endpoint, all `GET`, answering with a server-sent event
 * stream (`text/event-stream`) that ends after one final event:
 *
 *   event: hold       data: GatewayHold    (0..n: the request is waiting)
 *   event: response   data: <Riot's JSON>  (final: Riot's 2xx body, verbatim)
 *   event: error      data: GatewayFailure (final: Riot's final refusal or failure)
 *
 * A stream that ends without a final event (the gateway restarting) is
 * safe to retry. Before any stream opens, the gateway can answer plainly:
 * 400 (bad parameters or priority) or 403 (wrong secret). A request is
 * never refused for waiting too long or behind too many: buckets have no
 * size limit, and a waiting stream stays open as long as its turn takes.
 */

/** The shared secret, required once the gateway has `RIOT_GATEWAY_SECRET` set. */
export const GATEWAY_SECRET_HEADER = "x-riot-gateway-secret";
/** The request's bucket (`Priority`). Required. */
export const GATEWAY_PRIORITY_HEADER = "x-riot-priority";

/**
 * Why a request isn't at Riot yet, sent whenever that changes (its position
 * moves, or it reaches the front), never on a timer. Not sent to buckets
 * `hearsHolds` excludes (the crawler's).
 */
export type GatewayHold =
  /** `position` requests to the same Riot host go first (1 = right behind the front). */
  | { reason: "queue"; position: number }
  /** Next in line, waiting for the key's Riot budget (or a Retry-After) on that host. */
  | { reason: "rate_limit"; waitMs: number };

/**
 * Riot's final answer when it isn't a 2xx: a non-retryable status, or 429s,
 * 5xx or network failures that outlasted the gateway's retries (`status` 0:
 * no response at all).
 */
export interface GatewayFailure {
  status: number;
  message: string;
  /** Fails every request the same way (bad key, PUUID from another Riot app). */
  fatal: boolean;
}

/** One event of a gateway stream, by SSE event name. */
export type GatewayEvent =
  | { event: "hold"; data: GatewayHold }
  | { event: "response"; data: unknown }
  | { event: "error"; data: GatewayFailure };

const enc = encodeURIComponent;

/** Each route's path, as the client builds it (the gateway's Fastify patterns mirror these). */
export const gatewayPaths = {
  accountByRiotId: (platform: string, gameName: string, tagLine: string) =>
    `/${platform}/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`,
  accountByPuuid: (platform: string, puuid: string) => `/${platform}/riot/account/v1/accounts/by-puuid/${enc(puuid)}`,
  summonerByPuuid: (platform: string, puuid: string) => `/${platform}/lol/summoner/v4/summoners/by-puuid/${enc(puuid)}`,
  /** Query: queue, type, startTime, endTime (epoch seconds), start, count. */
  matchIdsByPuuid: (platform: string, puuid: string) => `/${platform}/lol/match/v5/matches/by-puuid/${enc(puuid)}/ids`,
  /** The platform comes from the match id's prefix. */
  match: (matchId: string) => `/lol/match/v5/matches/${enc(matchId)}`,
  matchTimeline: (matchId: string) => `/lol/match/v5/matches/${enc(matchId)}/timeline`,
};
