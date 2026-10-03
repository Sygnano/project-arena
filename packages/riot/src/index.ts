/**
 * What every process shares about Riot: routing (platforms, regional
 * clusters), queue ids, the gateway's priority buckets and wire protocol,
 * and the gateway client (`RiotGateway` -> `RiotClient`) that the API and
 * the scripts reach Riot through. The gateway itself is apps/riot-gateway.
 */

export { type GatewayRequestOptions, RiotGateway, type RiotGatewayOptions } from "./client/gateway.js";
export { type MatchIdFilters, type MatchIdPage, RiotClient } from "./client/riotClient.js";
export { RiotApiError } from "./errors.js";
export * from "./priority.js";
export * from "./protocol.js";
export * from "./queues.js";
export * from "./routing.js";
