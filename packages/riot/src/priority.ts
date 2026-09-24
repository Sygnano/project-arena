/**
 * The Riot gateway's priority buckets, highest first. Every request names
 * one (`x-riot-priority`), and the gateway runs a Riot host's requests
 * strictly in this order: a bucket goes through only once every bucket
 * above it has nothing waiting on that host. Within a bucket, first come
 * first served.
 *
 * - `lookup`: a visitor's Riot ID search (Account-V1 + Summoner-V4), someone
 *   is waiting on the page;
 * - `refresh`: new matches of a summoner who already has a recap;
 * - `firstFetch`: a summoner's whole history, their first recap;
 * - `crawler`: discovery and upkeep (the crawler, `check-recaps`,
 *   `retry-skipped`), whatever budget the site leaves.
 *
 * To add a bucket (a `vip` one day), insert it at its rank here: the gateway
 * builds its queues from this list, and callers pick it by name.
 */
export const PRIORITIES = ["lookup", "refresh", "firstFetch", "crawler"] as const;

export type Priority = (typeof PRIORITIES)[number];

/**
 * Buckets never told where they wait (no `hold` events): nobody watches the
 * crawler's progress call by call. Every other bucket hears its position
 * whenever it changes.
 */
const SILENT_PRIORITIES: ReadonlySet<Priority> = new Set(["crawler"]);

/** Whether the gateway sends this bucket's requests their `hold` events. */
export function hearsHolds(priority: Priority) {
  return !SILENT_PRIORITIES.has(priority);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}
