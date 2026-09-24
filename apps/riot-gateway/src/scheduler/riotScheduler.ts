import { PRIORITIES, hearsHolds, type GatewayHold, type Priority, type RoutingValue } from "@arena/riot";
import type { BucketWait } from "../riotApi/rateLimiting/rateBucket.js";
import type { RiotRateLimiter } from "../riotApi/rateLimiting/rateLimiter.js";
import type { RiotCall } from "../riotApi/types.js";

export interface AcquireOptions {
  /** Each change of why the request is still waiting (see `GatewayHold`). */
  onHold?: (hold: GatewayHold) => void;
  /** The first time it's next in line but Riot's budget isn't there (for logs). */
  onRateLimited?: (wait: BucketWait) => void;
  /** Aborting takes a waiting request out of its queue (the caller left). */
  signal?: AbortSignal;
  /** A retry of a request that already had its turn (Riot 429 or 5xx): goes
   * back to the front of its bucket. */
  retry?: boolean;
}

interface Waiter {
  call: RiotCall;
  options: AcquireOptions;
  release: () => void;
  /** The hold last sent ("rate_limit", "queue:3"), so it's only sent again when it changes. */
  hold: string | null;
  rateLimitLogged: boolean;
  /** Left the queue (sent, or its caller gone): skipped where it still sits. */
  gone: boolean;
}

/**
 * One bucket's waiters, first in first out, with no size limit: adding,
 * taking the first and putting a retry back in front are O(1), and a waiter
 * that leaves is only flagged (`gone`) and skipped when it reaches the front.
 */
class WaiterQueue {
  private items: Waiter[] = [];
  private start = 0;
  /** Waiters not gone. */
  size = 0;

  push(waiter: Waiter) {
    this.items.push(waiter);
    this.size += 1;
  }

  unshift(waiter: Waiter) {
    if (this.start > 0) this.items[--this.start] = waiter;
    else this.items.unshift(waiter);
    this.size += 1;
  }

  /** The first waiter still waiting. */
  first(): Waiter | undefined {
    while (this.start < this.items.length && this.items[this.start]!.gone) this.start += 1;
    this.compact();
    return this.items[this.start];
  }

  /** Flags it as gone; false if it already was. */
  remove(waiter: Waiter) {
    if (waiter.gone) return false;
    waiter.gone = true;
    this.size -= 1;
    return true;
  }

  /** The waiters still waiting, front first. */
  *[Symbol.iterator]() {
    for (let i = this.start; i < this.items.length; i++) if (!this.items[i]!.gone) yield this.items[i]!;
  }

  /** Drops the skipped front once it's most of the array. */
  private compact() {
    if (this.start === this.items.length) {
      this.items = [];
      this.start = 0;
    } else if (this.start > 1024 && this.start * 2 > this.items.length) {
      this.items = this.items.slice(this.start);
      this.start = 0;
    }
  }
}

/**
 * One Riot host's line (`europe`, `euw1`, ...): a FIFO per priority bucket.
 * The head is the first request of the highest non-empty bucket; it's sent
 * as soon as the host's budget allows, and nothing behind it moves until it
 * has gone, even a request its method limit wouldn't hold: a bucket goes
 * through only once every bucket above it is empty.
 *
 * Buckets have no size limit: every request waits for its turn, however
 * many are ahead of it, and a lower bucket waits as long as higher ones keep
 * receiving requests (its stream's heartbeats keep the caller connected).
 *
 * Waiters hear where they stand whenever it changes: `rate_limit` at the
 * front, `queue` with their position behind it. Every request sent moves
 * everyone behind it, so each round of sends ends with one pass over the
 * waiting requests, telling only those whose hold changed. That's one write
 * per waiting request per send, fine for the hundreds this is sized for;
 * the crawler's bucket, the one that piles up, is left out (`hearsHolds`).
 */
class HostQueue {
  private readonly buckets = new Map<Priority, WaiterQueue>(
    PRIORITIES.map((priority) => [priority, new WaiterQueue()]),
  );
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The buckets that hear their holds, highest first. */
  private readonly heard = PRIORITIES.filter(hearsHolds);

  constructor(private readonly limiter: RiotRateLimiter) {}

  waiting(priority: Priority) {
    return this.buckets.get(priority)!.size;
  }

  /** Queues it and sends whatever the budget allows. */
  add(waiter: Waiter) {
    const bucket = this.buckets.get(waiter.call.priority)!;
    if (waiter.options.retry) bucket.unshift(waiter);
    else bucket.push(waiter);
    this.pump();
  }

  /** False when it had already left the queue (sent). */
  remove(waiter: Waiter) {
    return this.buckets.get(waiter.call.priority)!.remove(waiter);
  }

  private head(): Waiter | undefined {
    for (const priority of PRIORITIES) {
      const first = this.buckets.get(priority)!.first();
      if (first) return first;
    }
    return undefined;
  }

  /**
   * Tells each waiting request of the heard buckets where it stands, if that
   * changed since it was last told: the front `rate_limit`, the rest their
   * position. A silent bucket (the crawler's, always the lowest) is never
   * ahead of a heard request, so the positions are the true count.
   */
  private sendHolds(headWait: BucketWait) {
    let position = 0;
    for (const priority of this.heard) {
      for (const waiter of this.buckets.get(priority)!) {
        const hold: GatewayHold =
          position === 0 ? { reason: "rate_limit", waitMs: Math.ceil(headWait.ms) } : { reason: "queue", position };
        const key = position === 0 ? "rate_limit" : `queue:${position}`;
        if (waiter.hold !== key) {
          waiter.hold = key;
          waiter.options.onHold?.(hold);
        }
        position += 1;
      }
    }
  }

  /**
   * Sends every request the budget allows, in priority order, then sleeps
   * until the head's wait is over. Runs again whenever a request arrives or
   * leaves, since a new head may have a different wait.
   */
  pump = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (;;) {
      const head = this.head();
      if (!head) return;
      const now = Date.now();
      const wait = this.limiter.wait(head.call, now);
      if (wait === null) {
        this.limiter.record(head.call, now);
        this.remove(head);
        head.release();
        continue;
      }
      this.sendHolds(wait);
      if (!head.rateLimitLogged) {
        head.rateLimitLogged = true;
        head.options.onRateLimited?.(wait);
      }
      // A few ms past the edge, so the recheck doesn't land just short of it.
      this.timer = setTimeout(this.pump, Math.ceil(wait.ms) + 5);
      return;
    }
  };
}

/**
 * Decides when each Riot request goes out: one `HostQueue` per Riot host
 * (routing value), since that's what Riot's limits count, over the one rate
 * limiter that knows each host's budget. Requests to different hosts never
 * wait for each other; on one host, strictly by priority bucket, then first
 * come first served.
 */
export class RiotScheduler {
  private readonly hosts = new Map<RoutingValue, HostQueue>();

  constructor(private readonly limiter: RiotRateLimiter) {}

  private host(routing: RoutingValue) {
    let queue = this.hosts.get(routing);
    if (!queue) this.hosts.set(routing, (queue = new HostQueue(this.limiter)));
    return queue;
  }

  /**
   * Resolves when it's this call's turn and the host's budget has room, and
   * counts it as sent (the caller sends it right away). Rejects only with
   * the signal's reason, once aborted while waiting.
   */
  acquire(call: RiotCall, options: AcquireOptions = {}): Promise<void> {
    const queue = this.host(call.routing);
    const { signal } = options;
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);

      const onAbort = () => {
        if (!queue.remove(waiter)) return;
        reject(signal!.reason);
        // Whoever was behind it may be the new head.
        queue.pump();
      };
      const waiter: Waiter = {
        call,
        options,
        hold: null,
        rateLimitLogged: false,
        gone: false,
        release: () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      queue.add(waiter);
    });
  }

  /** Requests waiting per host and bucket, for `/status`. Hosts with none are left out. */
  snapshot() {
    const hosts: Record<string, Partial<Record<Priority, number>>> = {};
    for (const [routing, queue] of this.hosts) {
      const counts: Partial<Record<Priority, number>> = {};
      for (const priority of PRIORITIES) counts[priority] = queue.waiting(priority);
      if (PRIORITIES.some((priority) => queue.waiting(priority) > 0)) hosts[routing] = counts;
    }
    return hosts;
  }
}
