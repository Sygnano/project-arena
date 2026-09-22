import { env } from "../env.js";
import { RiotClient } from "./client.js";

/** The process's Riot client. See README.md in this folder. */
export const riot = new RiotClient({ apiKey: env.RIOT_API_KEY, logLevel: env.RIOT_LOG_LEVEL });

export { RiotClient, DEV_KEY_APP_LIMITS, type RiotClientOptions } from "./client.js";
export { RiotApiError } from "./errors.js";
export { Queue, type QueueId } from "./queues.js";
export { PLATFORMS, isPlatform, type Platform, type Region } from "./routing.js";
export type { MatchIdFilters } from "./endpoints/matchV5.js";
