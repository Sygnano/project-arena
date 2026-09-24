import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Runs the startup migrations instead of DATABASE_URL when set, so the
  // role serving requests can be one without DDL rights (CLAUDE.md §3).
  MIGRATION_DATABASE_URL: z.string().min(1).optional(),
  // The Riot gateway (apps/riot-gateway), the only way to Riot: it holds the
  // key. Private network address in production.
  RIOT_GATEWAY_URL: z.string().url().default("http://localhost:3002"),
  // The gateway's RIOT_GATEWAY_SECRET, when it has one.
  RIOT_GATEWAY_SECRET: z.string().min(32, "RIOT_GATEWAY_SECRET must be at least 32 characters").optional(),
  // Shared with the web app's server: once set, every route but /health
  // refuses requests without it (index.ts). Unset only in local dev.
  API_PROXY_SECRET: z.string().min(32, "API_PROXY_SECRET must be at least 32 characters").optional(),
  PORT: z.coerce.number().default(3001),
  // App logs (src/logger.ts): trace | debug | info | warn | error | fatal | silent.
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  // Ceiling on the stats cache's memory (src/summoners/statsCache.ts).
  STATS_CACHE_MAX_MB: z.coerce.number().positive().default(1024),
  // The part of it that recaps kept for being recently viewed (not recently
  // refreshed) may use.
  STATS_CACHE_RECENT_MB: z.coerce.number().positive().default(256),
});

export const env = envSchema.parse(process.env);
