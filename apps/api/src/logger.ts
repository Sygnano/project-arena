import { pino } from "pino";
import { env } from "./env.js";

/**
 * The logger of every process (the API, shared with Fastify, which adds
 * request logs to it, and the scripts). Colored, one line per event in a
 * terminal; JSON lines on stdout elsewhere, with `level` as a word ("info",
 * "error"), which hosted logs (Railway) parse and filter on. Riot requests
 * are logged by the Riot gateway (apps/riot-gateway), not here.
 *
 * Modules log through a child carrying `module` (`queue`, `stats`, `refresh`,
 * `crawl`, ...), a regional cluster as `lane` where one applies, and a
 * summoner's Riot ID as `summoner` wherever one is involved.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(process.stdout.isTTY
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            // `riot` repeats the Riot line's columns as fields: already in the message.
            ignore: "pid,hostname,module,lane,riot",
            messageFormat: "{if module}[{module}] {end}{if lane}[{lane}] {end}{msg}",
          },
        },
      }
    : { formatters: { level: (label: string) => ({ level: label }) } }),
});

/** "Name#TAG", for log lines. */
export function riotIdLabel(summoner: { riotIdGameName: string; riotIdTagline: string }) {
  return `${summoner.riotIdGameName}#${summoner.riotIdTagline}`;
}
