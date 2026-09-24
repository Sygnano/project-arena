import { env } from "./env.js";
import { logger } from "./logger.js";
import { RiotHttpClient } from "./riotApi/http.js";
import { RiotLogger } from "./riotApi/logger.js";
import type { WindowLimit } from "./riotApi/rateLimiting/headers.js";
import { RiotRateLimiter } from "./riotApi/rateLimiting/rateLimiter.js";
import { RiotScheduler } from "./scheduler/riotScheduler.js";

/**
 * A development or personal key's app limits, per region. Only the starting
 * point: the first response from each region replaces them with what Riot
 * reports, so a production key needs no change here.
 */
const DEV_KEY_APP_LIMITS: WindowLimit[] = [
  { limit: 20, windowSec: 1 },
  { limit: 100, windowSec: 120 },
];

/** The process's one rate limiter: it knows every Riot host's budget. */
const limiter = new RiotRateLimiter(DEV_KEY_APP_LIMITS);

/** Whose turn it is on each Riot host (see `RiotScheduler`). */
export const scheduler = new RiotScheduler(limiter);

/** Makes the Riot requests, each once the scheduler gives it its turn. */
export const riotHttp = new RiotHttpClient({
  apiKey: env.RIOT_API_KEY,
  limiter,
  scheduler,
  logger: new RiotLogger(env.RIOT_LOG_LEVEL, logger.child({ module: "riot" }, { level: env.RIOT_LOG_LEVEL })),
});
