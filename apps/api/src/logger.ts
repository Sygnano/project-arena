import { pino } from "pino";
import { env } from "./env.js";

/**
 * The API's logger, shared with Fastify (which adds request logs to it).
 * Colored, one line per event in a terminal; plain JSON lines elsewhere
 * (hosted logs parse them). Riot requests have their own logger, see
 * riotApi/logger.ts.
 *
 * Modules log through a child carrying `module` (`queue`, `stats`, ...), and
 * a summoner's Riot ID as `summoner` wherever one is involved.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(process.stdout.isTTY && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,module", messageFormat: "{if module}[{module}] {end}{msg}" },
    },
  }),
});

/** "Name#TAG", for log lines. */
export function riotIdLabel(summoner: { riotIdGameName: string; riotIdTagline: string }) {
  return `${summoner.riotIdGameName}#${summoner.riotIdTagline}`;
}
