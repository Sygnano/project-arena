import type { RiotCall } from "../types.js";
import type { RateLimitHeaders, RateLimitScope, WindowLimit } from "./headers.js";
import { RateBucket, type BucketWait, type WindowUsage } from "./rateBucket.js";

/**
 * Riot's rate limits, per its developer portal: every limit is enforced
 * **per routing value** (europe, americas, euw1, na1, ... each have their
 * own budget), at two levels:
 *
 * - **application**: every call to that host with our key;
 * - **method**: every call to one endpoint on that host.
 *
 * So a call must fit in its host's app bucket and its (host, endpoint)
 * method bucket. A crawl of EUW players never slows down a lookup on NA, and
 * Account-V1 on `europe` shares the `europe` app budget with Match-V5 but
 * not with Summoner-V4 on `euw1`.
 *
 * App buckets start from `defaultAppLimits` (a dev key's, until Riot says
 * otherwise); method buckets start empty. Both then follow the limits and
 * counts Riot sends back on every response.
 */
export class RiotRateLimiter {
  private buckets = new Map<string, RateBucket>();

  constructor(private readonly defaultAppLimits: WindowLimit[]) {}

  private bucket(key: string, label: string, initial: WindowLimit[] = []) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new RateBucket(label, initial);
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private appBucket(call: RiotCall) {
    return this.bucket(`app:${call.routing}`, `${call.routing} limit`, this.defaultAppLimits);
  }

  private methodBucket(call: RiotCall) {
    return this.bucket(`method:${call.routing}:${call.api}.${call.method}`, `method limit`);
  }

  /**
   * Resolves once the call fits in both of its buckets, and counts it as
   * sent. Waiters recheck when they wake rather than holding a ticket, so a
   * pause set meanwhile (a 429 elsewhere on the host) is honored. `onWait`
   * is called with the first wait only; the returned total covers them all.
   */
  async acquire(call: RiotCall, onWait?: (wait: BucketWait) => void): Promise<number> {
    const app = this.appBucket(call);
    const method = this.methodBucket(call);
    let waited = 0;
    for (;;) {
      const now = Date.now();
      const waits = [app.wait(now), method.wait(now)].filter((wait) => wait !== null);
      if (waits.length === 0) {
        app.record(now);
        method.record(now);
        return waited;
      }
      const longest = waits.reduce((a, b) => (b.ms > a.ms ? b : a));
      if (waited === 0) onWait?.(longest);
      // A few ms past the edge, so the recheck doesn't land just short of it.
      const ms = Math.ceil(longest.ms) + 5;
      await new Promise((resolve) => setTimeout(resolve, ms));
      waited += ms;
    }
  }

  /** Adopts the limits and counts Riot reported on a response to this call. */
  update(call: RiotCall, headers: RateLimitHeaders) {
    const now = Date.now();
    const app = this.appBucket(call);
    const method = this.methodBucket(call);
    app.setLimits(headers.appLimits);
    app.syncCounts(headers.appCounts, now);
    method.setLimits(headers.methodLimits);
    method.syncCounts(headers.methodCounts, now);
  }

  /**
   * Holds back every call a 429 applies to, per Riot's "halt future API
   * calls for the duration of Retry-After". An application 429 stops the
   * whole host; a method or service 429 (or one without a type, from the
   * service underneath) stops only that endpoint on that host.
   */
  pause(call: RiotCall, scope: RateLimitScope | undefined, ms: number) {
    const bucket = scope === "application" ? this.appBucket(call) : this.methodBucket(call);
    bucket.pauseFor(ms, Date.now());
  }

  /** How full the call's buckets are, for logs. */
  usage(call: RiotCall): { app: WindowUsage | null; method: WindowUsage | null } {
    const now = Date.now();
    return { app: this.appBucket(call).tightestWindow(now), method: this.methodBucket(call).tightestWindow(now) };
  }
}
