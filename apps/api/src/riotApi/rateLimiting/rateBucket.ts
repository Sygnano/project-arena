import { formatWindow, type WindowCount, type WindowLimit } from "./headers.js";
import { RateWindow } from "./rateWindow.js";

/** Why a bucket is holding requests back, for logs. */
export interface BucketWait {
  ms: number;
  reason: string;
}

export interface WindowUsage {
  used: number;
  limit: number;
  windowSec: number;
}

/**
 * Everything one Riot limit needs: its windows (a limit usually has
 * several, e.g. 20/1s and 100/2m) plus a pause set by a 429's Retry-After.
 * A request goes out only when every window has room and no pause is on.
 */
export class RateBucket {
  private windows = new Map<number, RateWindow>();
  private pausedUntil = 0;

  constructor(
    /** "app europe", "method europe Match-V5.getMatch": shown when it holds a request back. */
    public readonly label: string,
    initialLimits: WindowLimit[] = [],
  ) {
    this.setLimits(initialLimits);
  }

  /**
   * Adopts the limits Riot reports for this bucket, so a production key's
   * higher limits (or a method's own) take effect from its first response,
   * without config. Windows Riot no longer reports are dropped; an empty
   * list (header missing) changes nothing.
   */
  setLimits(limits: WindowLimit[]) {
    if (limits.length === 0) return;
    const seen = new Set<number>();
    for (const { limit, windowSec } of limits) {
      seen.add(windowSec);
      const window = this.windows.get(windowSec);
      if (window) window.limit = limit;
      else this.windows.set(windowSec, new RateWindow(limit, windowSec));
    }
    for (const windowSec of this.windows.keys()) if (!seen.has(windowSec)) this.windows.delete(windowSec);
  }

  syncCounts(counts: WindowCount[], now: number) {
    for (const { count, windowSec } of counts) this.windows.get(windowSec)?.syncCount(count, now);
  }

  pauseFor(ms: number, now: number) {
    this.pausedUntil = Math.max(this.pausedUntil, now + ms);
  }

  /** How long until this bucket lets a request through, or null if it does now. */
  wait(now: number): BucketWait | null {
    let longest: BucketWait | null = null;
    if (this.pausedUntil > now) longest = { ms: this.pausedUntil - now, reason: `${this.label} paused by Retry-After` };
    for (const window of this.windows.values()) {
      const ms = window.waitMs(now);
      if (ms > 0 && (!longest || ms > longest.ms)) {
        longest = { ms, reason: `${this.label} ${window.limit}/${formatWindow(window.windowSec)} full` };
      }
    }
    return longest;
  }

  record(now: number) {
    for (const window of this.windows.values()) window.record(now);
  }

  /** The window closest to its limit (highest used/limit ratio). */
  tightestWindow(now: number): WindowUsage | null {
    let tightest: WindowUsage | null = null;
    for (const window of this.windows.values()) {
      const usage = { used: window.used(now), limit: window.limit, windowSec: window.windowSec };
      if (!tightest || usage.used / usage.limit > tightest.used / tightest.limit) tightest = usage;
    }
    return tightest;
  }
}
