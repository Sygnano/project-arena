import picocolors from "picocolors";
import { formatWindow } from "./rateLimiting/headers.js";
import type { WindowUsage } from "./rateLimiting/rateBucket.js";
import { PRIORITIES, REGION_LABEL, isPlatform, matchRegion, type Region } from "@arena/riot";
import type { RiotCall } from "./types.js";

/**
 * One line per Riot request event, in fixed columns so a scrolling log
 * reads at a glance:
 *
 *   200  - [Europe]   [EUW1] [Match-V5]    [refresh]    getMatch: EUW1_7851809865 · 412ms · europe 45/100 2m
 *   404  - [Europe]   [EUW1] [Account-V1]  [lookup]     getAccountByRiotId: Nobody#EUW · 98ms
 *   WAIT - [Europe]   [EUW1] [Match-V5]    [crawler]    getMatch: EUW1_7851809866 · 34.2s · europe limit 100/2m full
 *   429  - [Americas] [NA1]  [Match-V5]    [firstFetch] getMatchIdsByPuuid: 3fA9x…Qe1 · method limit, retry 1/4 in 10s
 *   ERR  - [Europe]   [EUW1] [Summoner-V4] [crawler]    getSummonerByPuuid: 3fA9x…Qe1 · timeout, retry 2/4 in 2s
 *
 * The region is the platform's cluster even for platform-routed calls, so
 * every line carries both. The bracket after the API is the caller's
 * priority bucket. Colors come from picocolors, which turns them off when
 * the output isn't a terminal (NO_COLOR / FORCE_COLOR are honored).
 *
 * The lines go to a `RiotLogSink`: in the gateway, a pino child logger (see
 * src/riot.ts), so hosted logs get them as JSON like every other line, with the
 * columns as fields under `riot`. Without one, to the console.
 */

// Only in a terminal: elsewhere the line is a JSON log's message, where
// escape codes are noise (picocolors alone keeps them on in any Windows
// process).
const pc = picocolors.createColors(picocolors.isColorSupported && process.stdout.isTTY === true);

export const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

// Widest value of each column, so the columns line up.
const REGION_WIDTH = "[Americas]".length;
const PLATFORM_WIDTH = "[EUW1]".length;
const API_WIDTH = "[Summoner-V4]".length;
const PRIORITY_WIDTH = Math.max(...PRIORITIES.map((priority) => priority.length)) + 2;

function regionOf(call: RiotCall): Region {
  return isPlatform(call.routing) ? matchRegion(call.platform) : call.routing;
}

/** PUUIDs are 78 characters; the first and last few are enough to tell them apart. */
function shorten(arg: string) {
  return arg.length > 40 ? `${arg.slice(0, 6)}…${arg.slice(-4)}` : arg;
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return pc.green;
  if (status === 429) return pc.magenta;
  if (status >= 500) return pc.red;
  return pc.yellow;
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`;
}

export function formatUsage(label: string, usage: WindowUsage | null) {
  if (!usage) return null;
  const text = `${label} ${usage.used}/${usage.limit} ${formatWindow(usage.windowSec)}`;
  const ratio = usage.used / usage.limit;
  return ratio >= 0.9 ? pc.yellow(text) : text;
}

/** Where the lines go. A pino logger fits as is. */
export interface RiotLogSink {
  debug(fields: object, message: string): void;
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
  error(fields: object, message: string): void;
}

const consoleSink: RiotLogSink = {
  debug: (_, message) => console.log(message),
  info: (_, message) => console.log(message),
  warn: (_, message) => console.warn(message),
  error: (_, message) => console.error(message),
};

export class RiotLogger {
  constructor(
    private readonly level: LogLevel = "info",
    private readonly sink: RiotLogSink = consoleSink,
  ) {}

  enabled(level: Exclude<LogLevel, "silent">) {
    return RANK[level] >= RANK[this.level];
  }

  /**
   * Logs one event about a call. `tag` is the HTTP status, or a word for
   * events without one (WAIT, ERR). `details` are appended after " · ",
   * nulls skipped. Failures print full ids, since they're what you'll search for.
   */
  log(level: Exclude<LogLevel, "silent">, call: RiotCall, tag: number | string, details: Array<string | null>) {
    if (!this.enabled(level)) return;

    const tagText = String(tag).padEnd(4);
    const coloredTag =
      typeof tag === "number" ? statusColor(tag)(tagText) : tag === "WAIT" ? pc.cyan(tagText) : pc.red(tagText);

    const region = `[${REGION_LABEL[regionOf(call)]}]`.padEnd(REGION_WIDTH);
    const platform = `[${call.platform.toUpperCase()}]`.padEnd(PLATFORM_WIDTH);
    const api = `[${call.api}]`.padEnd(API_WIDTH);
    const priority = `[${call.priority}]`.padEnd(PRIORITY_WIDTH);
    const args = (level === "info" || level === "debug" ? call.args.map(shorten) : call.args).join(" ");

    const suffix = details.filter((d) => d !== null).join(" · ");
    const line =
      `${pc.bold(coloredTag)} ${pc.dim("-")} ${pc.cyan(region)} ${pc.blue(platform)} ${pc.magenta(api)} ${pc.dim(priority)} ` +
      `${call.method}${args ? `: ${args}` : ""}${suffix ? pc.dim(` · ${suffix}`) : ""}`;

    // Full arguments here, whatever the level: a field is for searching.
    const fields = {
      riot: {
        tag,
        region: regionOf(call),
        platform: call.platform,
        api: call.api,
        method: call.method,
        priority: call.priority,
        args: call.args,
      },
    };
    this.sink[level](fields, line);
  }
}
