/**
 * Riot's rate-limit headers, as seen on real responses:
 *
 *   X-App-Rate-Limit:          100:120,20:1   (limit:windowSeconds, one per window)
 *   X-App-Rate-Limit-Count:    80:120,2:1     (used:windowSeconds, this request included)
 *   X-Method-Rate-Limit:       2000:10
 *   X-Method-Rate-Limit-Count: 5:10
 *   X-Rate-Limit-Type:         application | method | service   (on a 429 only)
 *   Retry-After:               seconds                          (on a 429, usually)
 */

/** One window of a limit: at most `limit` requests every `windowSec` seconds. */
export interface WindowLimit {
  limit: number;
  windowSec: number;
}

/** How much of one window has been used, per Riot. */
export interface WindowCount {
  count: number;
  windowSec: number;
}

export type RateLimitScope = "application" | "method" | "service";

/** Parses "100:120,20:1" into `[value, windowSec]` pairs, skipping anything malformed. */
function parsePairs(header: string | null): Array<[number, number]> {
  if (!header) return [];
  return header.split(",").flatMap((pair) => {
    const [value, windowSec] = pair.split(":").map(Number);
    return Number.isFinite(value) && Number.isFinite(windowSec) && windowSec! > 0 ? [[value!, windowSec!]] : [];
  });
}

export interface RateLimitHeaders {
  appLimits: WindowLimit[];
  appCounts: WindowCount[];
  methodLimits: WindowLimit[];
  methodCounts: WindowCount[];
  /** Which limit a 429 was for. Absent on a 429 from the underlying service. */
  scope?: RateLimitScope;
  /** Retry-After in ms, when Riot sent it. */
  retryAfterMs?: number;
}

export function readRateLimitHeaders(headers: Headers): RateLimitHeaders {
  const limits = (name: string) => parsePairs(headers.get(name)).map(([limit, windowSec]) => ({ limit, windowSec }));
  const counts = (name: string) => parsePairs(headers.get(name)).map(([count, windowSec]) => ({ count, windowSec }));
  const type = headers.get("x-rate-limit-type");
  const retryAfter = Number(headers.get("retry-after"));
  return {
    appLimits: limits("x-app-rate-limit"),
    appCounts: counts("x-app-rate-limit-count"),
    methodLimits: limits("x-method-rate-limit"),
    methodCounts: counts("x-method-rate-limit-count"),
    scope: type === "application" || type === "method" || type === "service" ? type : undefined,
    retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
  };
}

/** "120s" -> "2m", for log lines. */
export function formatWindow(windowSec: number) {
  if (windowSec % 3600 === 0) return `${windowSec / 3600}h`;
  if (windowSec % 60 === 0) return `${windowSec / 60}m`;
  return `${windowSec}s`;
}
