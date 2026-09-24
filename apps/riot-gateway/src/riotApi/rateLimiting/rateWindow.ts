/**
 * Riot counts a window from its first request and can see a request a few
 * ms after we send it, so every window is treated as this much longer than
 * Riot's to keep a request at the edge from landing in a full window.
 */
const SAFETY_MARGIN_MS = 250;

/**
 * One limit window (e.g. 100 requests / 120s) as a sliding log of send
 * times. A sliding window is stricter than Riot's fixed ones: any stretch of
 * `windowSec` holds at most `limit` requests, so Riot's windows do too.
 */
export class RateWindow {
  private sentAt: number[] = [];

  constructor(
    public limit: number,
    public readonly windowSec: number,
  ) {}

  private get windowMs() {
    return this.windowSec * 1000 + SAFETY_MARGIN_MS;
  }

  private prune(now: number) {
    const cutoff = now - this.windowMs;
    let expired = 0;
    while (expired < this.sentAt.length && this.sentAt[expired]! <= cutoff) expired++;
    if (expired > 0) this.sentAt.splice(0, expired);
  }

  used(now: number) {
    this.prune(now);
    return this.sentAt.length;
  }

  /** Ms until one more request fits (0 = now). */
  waitMs(now: number) {
    this.prune(now);
    if (this.sentAt.length < this.limit) return 0;
    // Enough of the oldest sends must expire to get back under the limit
    // (more than one if the limit just shrank).
    const blocking = this.sentAt[this.sentAt.length - this.limit]!;
    return Math.max(0, blocking + this.windowMs - now);
  }

  record(now: number) {
    this.sentAt.push(now);
  }

  /**
   * Adopts Riot's count when it's higher than ours: anything else using the
   * same key (a second gateway, a local run with the hosted key) spends the
   * same budget. The missing requests are logged as sent now, the safe guess.
   */
  syncCount(riotCount: number, now: number) {
    const missing = riotCount - this.used(now);
    for (let i = 0; i < missing; i++) this.sentAt.push(now);
  }
}
