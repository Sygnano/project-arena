/**
 * What every process shares about Riot: routing (platforms, regional
 * clusters), queue ids, the gateway's priority buckets and wire protocol,
 * and the gateway client (`RiotGateway` -> `RiotClient`) that the API and
 * the scripts reach Riot through. The gateway itself is apps/riot-gateway.
 */
export * from "./routing.js";
export * from "./queues.js";
export * from "./priority.js";
export * from "./protocol.js";
export { RiotApiError } from "./errors.js";
export { RiotGateway, type RiotGatewayOptions, type GatewayRequestOptions } from "./client/gateway.js";
export { RiotClient, type MatchIdFilters, type MatchIdPage } from "./client/riotClient.js";
