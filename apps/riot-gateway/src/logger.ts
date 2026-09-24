import { pino } from "pino";
import { env } from "./env.js";

/**
 * The gateway's logger, shared with Fastify. Colored, one line per event in
 * a terminal; JSON lines on stdout elsewhere, with `level` as a word, which
 * hosted logs (Railway) parse and filter on. Riot requests log through a
 * child of it (`module: "riot"`, see riotApi/logger.ts).
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
            ignore: "pid,hostname,module,riot",
            messageFormat: "{if module}[{module}] {end}{msg}",
          },
        },
      }
    : { formatters: { level: (label: string) => ({ level: label }) } }),
});
