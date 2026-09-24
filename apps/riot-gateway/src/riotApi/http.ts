import { hostFor, type GatewayHold } from "@arena/riot";
import type { RiotScheduler } from "../scheduler/riotScheduler.js";
import { RiotCallError, errorFromResponse } from "./errors.js";
import { formatDuration, formatUsage, type RiotLogger } from "./logger.js";
import { readRateLimitHeaders, type RateLimitScope } from "./rateLimiting/headers.js";
import type { RiotRateLimiter } from "./rateLimiting/rateLimiter.js";
import type { RiotCall } from "./types.js";

export interface RiotHttpOptions {
  apiKey: string;
  /** The limiter the scheduler decides with: responses update it. */
  limiter: RiotRateLimiter;
  scheduler: RiotScheduler;
  logger: RiotLogger;
  /** Tries per call when Riot answers 429 or 5xx, or the network fails. */
  maxAttempts?: number;
  /** A connection that hangs would otherwise stall ingestion forever. */
  timeoutMs?: number;
}

export interface RiotRequestOptions {
  /** Why the request is still waiting, each time that changes. */
  onHold?: (hold: GatewayHold) => void;
  /** The caller left: a request still waiting leaves its queue, a retry isn't made. */
  signal?: AbortSignal;
}

/** Waits of at least this long log at info; shorter ones are routine pacing and log at debug. */
const NOTABLE_WAIT_MS = 5000;
/** Time in the queue shown on the response's log line from this long up. */
const SHOWN_QUEUE_MS = 1000;

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
 * every call needs — its turn (the scheduler: priority, then rate limits),
 * the API key, timeout, retries, turning failures into `RiotCallError`, and
 * a log line for each outcome. Returns Riot's body as text, unparsed: the
 * gateway passes it on verbatim.
 *
 * Retries (up to `maxAttempts` tries in all), each back at the front of its
 * bucket:
 * - 429: Riot's Retry-After pauses the limit it names (see
 *   `RiotRateLimiter.pause`), and the retry waits in the scheduler like any call;
 * - 5xx and network errors (a response cut off mid-download too):
 *   exponential backoff;
 * - anything else (400, 401, 403, 404, ...) fails at once.
 */
export class RiotHttpClient {
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: RiotHttpOptions) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async request(call: RiotCall, options: RiotRequestOptions = {}): Promise<string> {
    const { limiter, scheduler, logger, apiKey } = this.options;
    const url = buildUrl(call);
    const retry = (attempt: number, ms: number) => `retry ${attempt}/${this.maxAttempts - 1} in ${formatDuration(ms)}`;
    const queuedAt = performance.now();

    for (let attempt = 1; ; attempt++) {
      options.signal?.throwIfAborted();
      await scheduler.acquire(call, {
        retry: attempt > 1,
        signal: options.signal,
        onHold: options.onHold,
        onRateLimited: (wait) => {
          logger.log(wait.ms >= NOTABLE_WAIT_MS ? "info" : "debug", call, "WAIT", [
            formatDuration(wait.ms),
            wait.reason,
          ]);
        },
      });
      const queuedMs = attempt === 1 ? performance.now() - queuedAt : 0;

      // No response at all (reset, DNS, timeout), or one cut off while it
      // downloads: transient, like a 5xx. Throws once out of tries.
      const networkError = async (err: unknown) => {
        const reason = describeNetworkError(err, this.timeoutMs);
        if (attempt >= this.maxAttempts) {
          logger.log("error", call, "ERR", [reason, `gave up after ${attempt} tries`]);
          throw new RiotCallError(
            0,
            call,
            `Riot API request failed for ${call.api} ${call.method}(${call.args.join(", ")}): ${reason}`,
          );
        }
        const ms = backoffMs(attempt);
        logger.log("warn", call, "ERR", [reason, retry(attempt, ms)]);
        await sleep(ms);
      };

      const startedAt = performance.now();
      let res: Response;
      try {
        res = await fetch(url, { headers: { "X-Riot-Token": apiKey }, signal: AbortSignal.timeout(this.timeoutMs) });
      } catch (err) {
        await networkError(err);
        continue;
      }

      const headers = readRateLimitHeaders(res.headers);
      limiter.update(call, headers);

      // The headers are in, but the body is still downloading (a timeline is
      // about 1.5 MB), and a reset or the timeout can still hit it.
      let body: string;
      try {
        body = await res.text();
      } catch (err) {
        await networkError(err);
        continue;
      }
      const took = formatDuration(performance.now() - startedAt);

      if (res.ok) {
        if (logger.enabled("info")) {
          const usage = limiter.usage(call);
          const method = usage.method && usage.method.used / usage.method.limit >= 0.5 ? usage.method : null;
          logger.log("info", call, res.status, [
            took,
            queuedMs >= SHOWN_QUEUE_MS ? `queued ${formatDuration(queuedMs)}` : null,
            formatUsage(call.routing, usage.app),
            formatUsage("method", method),
          ]);
        }
        return body;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxAttempts) {
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

      const error = errorFromResponse(call, res.status, body);
      // A 404 is an answer (no such Riot ID / match), not a malfunction.
      const level = res.status === 404 ? "info" : "error";
      logger.log(level, call, res.status, [
        took,
        retryable ? `gave up after ${attempt} tries` : null,
        level === "error" ? error.message : null,
      ]);
      throw error;
    }
  }
}
