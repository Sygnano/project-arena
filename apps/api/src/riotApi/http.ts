import { RiotApiError, errorFromResponse } from "./errors.js";
import { formatDuration, formatUsage, type RiotLogger } from "./logger.js";
import { readRateLimitHeaders, type RateLimitScope } from "./rateLimiting/headers.js";
import type { RiotRateLimiter } from "./rateLimiting/rateLimiter.js";
import { hostFor } from "./routing.js";
import type { RiotCall } from "./types.js";

export interface RiotHttpOptions {
  apiKey: string;
  limiter: RiotRateLimiter;
  logger: RiotLogger;
  /** Tries per call when Riot answers 429 or 5xx, or the network fails. */
  maxAttempts?: number;
  /** A connection that hangs would otherwise stall ingestion forever. */
  timeoutMs?: number;
}

/** Waits of at least this long log at info; shorter ones are routine pacing and log at debug. */
const NOTABLE_WAIT_MS = 5000;

/** Which limit a 429 was for. The key's own limit is per host, so it's named after it (`europe limit`). */
function scopeLabel(scope: RateLimitScope, call: RiotCall) {
  return scope === "application" ? `${call.routing} limit` : `${scope} limit`;
}

/** 2s, 4s, 8s, ... capped at 30s: for 5xx, network errors and 429s without Retry-After. */
function backoffMs(attempt: number) {
  return Math.min(2000 * 2 ** (attempt - 1), 30_000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(call: RiotCall) {
  const url = new URL(call.path, hostFor(call.routing));
  for (const [key, value] of Object.entries(call.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

function describeNetworkError(err: unknown, timeoutMs: number) {
  if (err instanceof Error && err.name === "TimeoutError") return `timeout after ${formatDuration(timeoutMs)}`;
  if (!(err instanceof Error)) return String(err);
  const code = (err.cause as { code?: string } | undefined)?.code;
  return code ? `${err.message} (${code})` : err.message;
}

/**
 * The one place a Riot request is made. Knows nothing about specific
 * endpoints: it takes a `RiotCall` from an endpoint file and handles what
 * every call needs — rate limiting, the API key, timeout, retries, turning
 * failures into `RiotApiError`, and a log line for each outcome.
 *
 * Retries (up to `maxAttempts` tries in all):
 * - 429: Riot's Retry-After pauses the limit it names (see
 *   `RiotRateLimiter.pause`), and the retry waits in the limiter like any call;
 * - 5xx and network errors: exponential backoff;
 * - anything else (400, 401, 403, 404, ...) fails at once.
 */
export class RiotHttpClient {
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: RiotHttpOptions) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async request<T>(call: RiotCall): Promise<T> {
    const { limiter, logger, apiKey } = this.options;
    const url = buildUrl(call);
    const retry = (attempt: number, ms: number) => `retry ${attempt}/${this.maxAttempts - 1} in ${formatDuration(ms)}`;

    for (let attempt = 1; ; attempt++) {
      await limiter.acquire(call, (wait) => {
        logger.log(wait.ms >= NOTABLE_WAIT_MS ? "info" : "debug", call, "WAIT", [formatDuration(wait.ms), wait.reason]);
      });

      const startedAt = performance.now();
      let res: Response;
      try {
        res = await fetch(url, { headers: { "X-Riot-Token": apiKey }, signal: AbortSignal.timeout(this.timeoutMs) });
      } catch (err) {
        // No response at all (reset, DNS, timeout): transient, like a 5xx.
        const reason = describeNetworkError(err, this.timeoutMs);
        if (attempt >= this.maxAttempts) {
          logger.log("error", call, "ERR", [reason, `gave up after ${attempt} tries`]);
          throw new RiotApiError(0, call, `Riot API request failed for ${call.api} ${call.method}(${call.args.join(", ")}): ${reason}`);
        }
        const ms = backoffMs(attempt);
        logger.log("warn", call, "ERR", [reason, retry(attempt, ms)]);
        await sleep(ms);
        continue;
      }

      const took = formatDuration(performance.now() - startedAt);
      const headers = readRateLimitHeaders(res.headers);
      limiter.update(call, headers);

      if (res.ok) {
        const data = (await res.json()) as T;
        if (logger.enabled("info")) {
          const usage = limiter.usage(call);
          const method = usage.method && usage.method.used / usage.method.limit >= 0.5 ? usage.method : null;
          logger.log("info", call, res.status, [took, formatUsage(call.routing, usage.app), formatUsage("method", method)]);
        }
        return data;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxAttempts) {
        await res.body?.cancel();
        if (res.status === 429) {
          const ms = headers.retryAfterMs ?? backoffMs(attempt);
          limiter.pause(call, headers.scope, ms);
          const which = headers.scope ? `${scopeLabel(headers.scope, call)} hit` : "limited by the service underneath";
          logger.log("warn", call, res.status, [took, which, retry(attempt, ms)]);
        } else {
          const ms = backoffMs(attempt);
          logger.log("warn", call, res.status, [took, retry(attempt, ms)]);
          await sleep(ms);
        }
        continue;
      }

      const error = errorFromResponse(call, res.status, await res.text());
      // A 404 is an answer (no such Riot ID / match), not a malfunction.
      const level = res.status === 404 ? "info" : "error";
      logger.log(level, call, res.status, [took, retryable ? `gave up after ${attempt} tries` : null, level === "error" ? error.message : null]);
      throw error;
    }
  }
}
