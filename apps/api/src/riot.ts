import { RiotGateway } from "@arena/riot";
import { env } from "./env.js";

/**
 * This process's way to Riot: the Riot gateway (apps/riot-gateway), which
 * holds the key, keeps Riot's rate limits and runs requests by priority.
 * Every use picks its bucket (see `PRIORITIES` in @arena/riot):
 *
 *   riotGateway.client("lookup")      a visitor's Riot ID search
 *   riotGateway.client("refresh")     a recap's new matches
 *   riotGateway.client("firstFetch")  a first recap's whole history
 *   riotGateway.client("upkeep")      check-recaps, retry-skipped
 *   riotGateway.client("crawler")     the crawler
 */
export const riotGateway = new RiotGateway({ url: env.RIOT_GATEWAY_URL, secret: env.RIOT_GATEWAY_SECRET });
