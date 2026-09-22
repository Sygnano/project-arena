import type { FastifyRequest } from "fastify";

/**
 * A sliding-window request counter per key (a visitor's IP), in memory:
 * the API is one long-lived process, and a restart forgetting the counts is
 * harmless. Each key keeps the timestamps of its hits inside the window.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Counts a hit for `key` unless it's over the limit. On refusal, says how
   * long until the oldest hit leaves the window. */
  hit(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + this.windowMs - now) / 1000) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.sweep(now);
    return { ok: true };
  }

  /** Drops keys with no hit left in the window, so one-off visitors don't
   * pile up forever. */
  private sweep(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
    }
  }
}

/**
 * The visitor's IP. The browser never calls this API directly: every lookup
 * comes through the web app's server, so `request.ip` is the web server's
 * address and the web app forwards the visitor's in this header. Only
 * trustworthy while the API isn't reachable from the internet (anyone who
 * can call it can set the header); without the header, it falls back to
 * the connection's address.
 */
export function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-arena-client-ip"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.trim() || request.ip;
}
