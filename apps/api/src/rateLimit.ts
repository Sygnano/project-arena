import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";

/** How often each limiter drops keys with no hit left in their window. */
const SWEEP_EVERY_MS = 60_000;

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
  ) {
    // On a timer rather than on each hit: sweeping inside `hit` once past a
    // size made every request walk every key while an attacker kept many
    // keys alive.
    setInterval(() => this.sweep(Date.now()), SWEEP_EVERY_MS).unref();
  }

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

/** The eight 16-bit groups of an IPv6 address, `::` and a trailing IPv4 part expanded. */
function ipv6Groups(ip: string): number[] {
  const [head = "", tail] = ip.split("::");
  const parse = (part: string) =>
    part === ""
      ? []
      : part.split(":").flatMap((group) => {
          if (!group.includes(".")) return [parseInt(group, 16)];
          const [a, b, c, d] = group.split(".").map(Number);
          return [(a! << 8) | b!, (c! << 8) | d!];
        });
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

/**
 * The rate-limit key for an address. An IPv6 visitor usually holds a whole
 * /64 (2^64 addresses), so keying on the full address would give them
 * unlimited budgets: they're keyed on the /64. IPv4-mapped IPv6 counts as
 * the IPv4 address.
 */
export function rateLimitKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const groups = ipv6Groups(ip.split("%")[0]!);
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6]! >> 8, groups[6]! & 255, groups[7]! >> 8, groups[7]! & 255].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}::/64`;
}

/**
 * The visitor's rate-limit key. The browser never calls this API directly:
 * every lookup comes through the web app's server, so `request.ip` is the
 * web server's address and the web app forwards the visitor's in this
 * header. Trusted because, once `API_PROXY_SECRET` is set, only the web app
 * can call the API at all (see index.ts). A missing or malformed value
 * falls back to the connection's address.
 */
export function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-arena-client-ip"];
  const value = typeof forwarded === "string" ? forwarded.trim() : "";
  return rateLimitKey(isIP(value) ? value : request.ip);
}
