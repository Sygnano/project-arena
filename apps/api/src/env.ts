import { z } from "zod";
import { LOG_LEVELS } from "./riotApi/logger.js";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  RIOT_API_KEY: z.string().min(1, "RIOT_API_KEY is required"),
  PORT: z.coerce.number().default(3001),
  // App logs (src/logger.ts): trace | debug | info | warn | error | fatal | silent.
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  // Riot request logs (src/riotApi/logger.ts): debug | info | warn | error | silent.
  RIOT_LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  // Ceiling on the stats cache's memory (src/summoners/statsCache.ts).
  STATS_CACHE_MAX_MB: z.coerce.number().positive().default(1024),
});

export const env = envSchema.parse(process.env);
