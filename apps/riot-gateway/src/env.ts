import { z } from "zod";
import { LOG_LEVELS } from "./riotApi/logger.js";

const envSchema = z.object({
  RIOT_API_KEY: z.string().min(1, "RIOT_API_KEY is required"),
  // Shared with every caller: once set, every route but /health refuses
  // requests without it (index.ts). Unset only in local dev.
  RIOT_GATEWAY_SECRET: z.string().min(32, "RIOT_GATEWAY_SECRET must be at least 32 characters").optional(),
  PORT: z.coerce.number().default(3002),
  // App logs (src/logger.ts): trace | debug | info | warn | error | fatal | silent.
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  // Riot request logs (src/riotApi/logger.ts): debug | info | warn | error | silent.
  RIOT_LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export const env = envSchema.parse(process.env);
