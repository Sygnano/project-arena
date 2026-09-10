/**
 * Minimal token-bucket limiter for a personal/dev Riot API key
 * (20 requests/1s and 100 requests/2min). Queues calls rather than
 * rejecting them — fine at friend-group ingestion volume.
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }

  private waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.drain();
    });
  }

  private drain() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length < this.limit && this.queue.length > 0) {
      this.timestamps.push(now);
      const next = this.queue.shift()!;
      next();
      if (this.queue.length > 0) this.drain();
      return;
    }

    if (this.queue.length > 0) {
      const oldest = this.timestamps[0];
      const delay = oldest !== undefined ? this.windowMs - (now - oldest) : this.windowMs;
      setTimeout(() => this.drain(), Math.max(delay, 10));
    }
  }
}

export class CompositeRateLimiter {
  private limiters: RateLimiter[];

  constructor(limits: Array<{ limit: number; windowMs: number }>) {
    this.limiters = limits.map((l) => new RateLimiter(l.limit, l.windowMs));
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    // Acquire every window's slot before actually running the call.
    const run = this.limiters.reduceRight<() => Promise<T>>(
      (inner, limiter) => () => limiter.schedule(inner),
      fn,
    );
    return run();
  }
}
